#nullable enable

using System;
using System.Collections;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Net;
using System.Net.Sockets;
using System.Reflection;
using System.Reflection.Emit;
using System.Runtime.CompilerServices;
using System.Runtime.Loader;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading;
using System.Threading.Channels;
using System.Threading.Tasks;
using FrooxEngine;
using ResoniteModLoader;

namespace LazarusRmlBuilderCatalog;

public sealed class ResoniteApiCatalogScannerMod : ResoniteMod
{
    public override string Name =>
        "Resonite API Catalog Scanner";

    public override string Author =>
        "Patrick / Lazarus";

    public override string Version =>
        ScannerVersion;

    public override string Link =>
        "";

    private const int CatalogSchemaVersion = 8;
    private const string ScannerVersion = "1.11.0";
    private const int FingerprintContractVersion = 1;
    private const int MethodIdentityVersion = 2;
    private const string MethodIdentityAlgorithm =
        "assembly-neutral-declaring-type-and-signature-v2";
    private const int ReloadSafetyContractVersion = 1;
    private const int ReloadSafetyMinimumReaderVersion = 1;
    private const int ReloadSafetyMaximumReaderVersion = 1;
    private const string ReloadSafetyPolicy =
        "operation-structure-and-use-site-v2-compatible-v1";
    private const string FingerprintAlgorithm =
        "sha256-canonical-semantic-catalog-v1";
    private const int PreferredPort = 42719;
    private const int LastAllowedPort = 42729;
    private const string CatalogFileName =
        "resonite_api_catalog.json";
    private const int RuntimeBridgeVersion = 1;
    private const int RuntimeMaximumChannels = 64;
    private const int RuntimeMaximumValuesPerChannel = 512;
    private static readonly TimeSpan RuntimeActiveWindow =
        TimeSpan.FromSeconds(5);
    private static readonly TimeSpan RuntimeChannelRetention =
        TimeSpan.FromMinutes(30);
    private static readonly TimeSpan RuntimeUnchangedBroadcastInterval =
        TimeSpan.FromSeconds(1);

    private static readonly object StateLock =
        new();

    private static readonly SemaphoreSlim ScanGate =
        new(1, 1);

    private static readonly object RuntimeLock =
        new();

    private static readonly object ValueCarrierCacheLock =
        new();

    private static readonly Dictionary<Type, bool>
        ValueCarrierCache =
            new();

    private static readonly Dictionary<string, RuntimeChannelState>
        RuntimeChannels =
            new(StringComparer.Ordinal);

    private static readonly Dictionary<Guid, RuntimeSseSubscriber>
        RuntimeSubscribers =
            new();

    private static readonly IReadOnlyDictionary<short, OpCode>
        IlOpCodes =
            typeof(OpCodes)
                .GetFields(
                    BindingFlags.Public |
                    BindingFlags.Static)
                .Where(field =>
                    field.FieldType == typeof(OpCode))
                .Select(field =>
                    (OpCode)field.GetValue(null)!)
                .GroupBy(opcode =>
                    opcode.Value)
                .ToDictionary(
                    group => group.Key,
                    group => group.First());

    private static readonly JsonSerializerOptions JsonOptions =
        new()
        {
            PropertyNamingPolicy =
                JsonNamingPolicy.CamelCase,
            DefaultIgnoreCondition =
                JsonIgnoreCondition.WhenWritingNull,
            WriteIndented = false
        };

    private static readonly string CatalogDirectory =
        Path.Combine(
            Environment.GetFolderPath(
                Environment.SpecialFolder.LocalApplicationData),
            "LazarusRMLBuilder");

    private static readonly string CatalogPath =
        Path.Combine(
            CatalogDirectory,
            CatalogFileName);

    private static CancellationTokenSource? _lifetime;
    private static TcpListener? _listener;
    private static Task? _serverTask;
    private static int _scanWorkerScheduled;
    private static string _catalogJson =
        "{}";
    private static string _assemblyFingerprint =
        "";
    private static string _runtimeAssemblyFingerprint =
        "";
    private static string _catalogFingerprint =
        "";
    private static int _suppressedDuplicateTypeDefinitions;
    private static int _serverPort;
    private static int _requestedScanGeneration;
    private static int _completedScanGeneration;
    private static int _successfulScanGeneration;
    private static TaskCompletionSource<int> _catalogReadySignal =
        NewCatalogReadySignal();
    private static bool _started;
    private static long _runtimeSequence;
    private static long _runtimePublishFailureLogAfter;

    public override void OnEngineInit()
    {
        lock (StateLock)
        {
            if (_started)
            {
                Msg(
                    "[API Catalog] Scanner is already running.");
                return;
            }

            _started = true;
            _lifetime =
                new CancellationTokenSource();
        }

        Directory.CreateDirectory(
            CatalogDirectory);

        LoadCachedCatalog();

        AppDomain.CurrentDomain.AssemblyLoad +=
            OnAssemblyLoaded;

        AppDomain.CurrentDomain.ProcessExit +=
            OnProcessExit;

        if (Engine.Current is not null)
        {
            Engine.Current.OnShutdown +=
                OnEngineShutdown;
        }

        _serverTask = Task.Run(
            () => RunServerAsync(
                _lifetime!.Token));

        ScheduleScan();

        Msg(
            $"[API Catalog] Output: {CatalogPath}");
        Msg(
            $"[API Catalog] Builder probes http://127.0.0.1:{PreferredPort}-{LastAllowedPort}/resonite_api_catalog.json");
    }

    private static void ForceCatalogRescan()
    {
        lock (StateLock)
        {
            _assemblyFingerprint = "";
        }

        ScheduleScan();

        Msg(
            "[API Catalog] Forced rescan scheduled.");
    }

    private static void OnAssemblyLoaded(
        object? sender,
        AssemblyLoadEventArgs eventArgs)
    {
        if (ShouldScanAssembly(
                eventArgs.LoadedAssembly))
        {
            ScheduleScan();
        }
    }

    private static void OnEngineShutdown()
    {
        StopScanner();
    }

    private static void OnProcessExit(
        object? sender,
        EventArgs eventArgs)
    {
        StopScanner();
    }

    private static void StopScanner()
    {
        lock (StateLock)
        {
            if (!_started)
            {
                return;
            }

            _started = false;
        }

        AppDomain.CurrentDomain.AssemblyLoad -=
            OnAssemblyLoaded;
        AppDomain.CurrentDomain.ProcessExit -=
            OnProcessExit;

        if (Engine.Current is not null)
        {
            Engine.Current.OnShutdown -=
                OnEngineShutdown;
        }

        try
        {
            CompleteRuntimeSubscribers();
            _lifetime?.Cancel();
            _listener?.Stop();
        }
        catch
        {
        }
    }

    private static void ScheduleScan()
    {
        lock (StateLock)
        {
            if (
                !_started ||
                _lifetime?.IsCancellationRequested == true
            )
            {
                return;
            }

            bool wasReady =
                _catalogJson.Length > 2 &&
                _successfulScanGeneration ==
                _requestedScanGeneration;

            Interlocked.Increment(
                ref _requestedScanGeneration);

            if (wasReady ||
                _catalogReadySignal.Task.IsCompleted)
            {
                _catalogReadySignal =
                    NewCatalogReadySignal();
            }
        }

        EnsureScanWorker();
    }

    private static void EnsureScanWorker()
    {
        if (Interlocked.CompareExchange(
                ref _scanWorkerScheduled,
                1,
                0) != 0)
        {
            return;
        }

        _ = Task.Run(ProcessPendingScansAsync);
    }

    private static async Task ProcessPendingScansAsync()
    {
        try
        {
            while (IsScannerRunning())
            {
                int generation =
                    Volatile.Read(
                        ref _requestedScanGeneration);

                await ScanAndPublishAsync(
                    generation);

                if (generation ==
                    Volatile.Read(
                        ref _requestedScanGeneration))
                {
                    break;
                }
            }
        }
        finally
        {
            Volatile.Write(
                ref _scanWorkerScheduled,
                0);

            if (IsScannerRunning() &&
                Volatile.Read(
                    ref _completedScanGeneration) !=
                Volatile.Read(
                    ref _requestedScanGeneration))
            {
                EnsureScanWorker();
            }
        }
    }

    private static bool IsScannerRunning()
    {
        lock (StateLock)
        {
            return _started &&
                _lifetime?.IsCancellationRequested != true;
        }
    }

    private static async Task ScanAndPublishAsync(
        int generation)
    {
        await ScanGate.WaitAsync();
        bool scanSucceeded = false;

        try
        {
            Assembly[] assemblies =
                RelevantAssemblies();

            List<ApiAssemblyInfo> assemblyInfos =
                assemblies
                    .Select(BuildAssemblyInfo)
                    .OrderBy(
                        info => info.Name,
                        StringComparer.Ordinal)
                    .ToList();

            string assemblyFingerprint =
                ComputeAssemblyFingerprint(
                    assemblyInfos);

            lock (StateLock)
            {
                _runtimeAssemblyFingerprint =
                    assemblyFingerprint;
                if (
                    string.Equals(
                        _assemblyFingerprint,
                        assemblyFingerprint,
                        StringComparison.Ordinal) &&
                    _catalogJson.Length > 2
                )
                {
                    scanSucceeded = true;
                    return;
                }
            }

            ApiCatalog catalog =
                BuildCatalog(
                    assemblies,
                    assemblyInfos,
                    assemblyFingerprint);

            string json =
                JsonSerializer.Serialize(
                    catalog,
                    JsonOptions);

            await WriteAtomicallyAsync(
                CatalogPath,
                json);

            lock (StateLock)
            {
                _catalogJson = json;
                _assemblyFingerprint =
                    assemblyFingerprint;
                _catalogFingerprint =
                    catalog.CatalogFingerprint;
                _suppressedDuplicateTypeDefinitions =
                    catalog.SuppressedDuplicateTypeDefinitions;
            }

            scanSucceeded = true;

            Msg(
                $"[API Catalog] Updated {catalog.EngineVersion}: " +
                $"{catalog.Components.Count} components, " +
                $"{catalog.Types.Count} public types, " +
                $"{catalog.SlotAttachOverloads.Count} Slot.Attach* overloads, " +
                $"{catalog.SuppressedDuplicateTypeDefinitions} duplicate CLR type definitions suppressed.");
        }
        catch (Exception exception)
        {
            Msg(
                "[API Catalog] Scan failed: " +
                exception);

            Msg(
                "[API Catalog] The failed generation remains invalid. " +
                "The next relevant assembly-load event or an explicit rescan will retry it.");
        }
        finally
        {
            lock (StateLock)
            {
                Volatile.Write(
                    ref _completedScanGeneration,
                    generation);

                if (scanSucceeded)
                {
                    Volatile.Write(
                        ref _successfulScanGeneration,
                        generation);
                }

                if (
                    _catalogJson.Length > 2 &&
                    _successfulScanGeneration ==
                    _requestedScanGeneration
                )
                {
                    _catalogReadySignal.TrySetResult(
                        _successfulScanGeneration);
                }
            }

            ScanGate.Release();
        }
    }

    private static ApiCatalog BuildCatalog(
        Assembly[] assemblies,
        List<ApiAssemblyInfo> assemblyInfos,
        string assemblyFingerprint)
    {
        Type? componentBase =
            FindLoadedType(
                "FrooxEngine.Component");
        Type? workerBase =
            FindLoadedType(
                "FrooxEngine.Worker");
        Type? colliderBase =
            FindLoadedType(
                "FrooxEngine.Collider");
        Type? slotType =
            FindLoadedType(
                "FrooxEngine.Slot");

        List<Type> discoveredPublicTypes =
            assemblies
                .SelectMany(GetLoadableTypes)
                .Where(type =>
                    IsCatalogRelevantType(
                        type,
                        componentBase,
                        workerBase))
                .Distinct()
                .ToList();

        List<IGrouping<string, Type>> publicTypeGroups =
            discoveredPublicTypes
                .GroupBy(
                    CSharpTypeName,
                    StringComparer.Ordinal)
                .ToList();

        List<Type> publicTypes =
            publicTypeGroups
                .Select(group =>
                    group
                        .OrderBy(
                            type => HasAttribute(
                                type,
                                typeof(ObsoleteAttribute)
                                    .FullName!)
                                ? 1
                                : 0)
                        .ThenBy(
                            type => CatalogAssemblyPriority(
                                type.Assembly))
                        .ThenBy(
                            type =>
                                type.Assembly
                                    .GetName()
                                    .Name,
                            StringComparer.Ordinal)
                        .ThenBy(
                            type =>
                                type.Assembly
                                    .FullName,
                            StringComparer.Ordinal)
                        .First())
                .OrderBy(
                    type => type.FullName,
                    StringComparer.Ordinal)
                .ToList();

        int suppressedDuplicateTypeDefinitions =
            publicTypeGroups.Sum(group =>
                Math.Max(
                    0,
                    group.Count() - 1));

        List<ApiTypeInfo> typeInfos =
            publicTypes
                .Select(
                    type => BuildTypeInfo(
                        type,
                        componentBase,
                        workerBase,
                        colliderBase))
                .ToList();

        List<string> components =
            typeInfos
                .Where(
                    info =>
                        info.IsAttachableComponent &&
                        !info.IsObsolete &&
                        !info.IsLegacyNamed)
                .Select(
                    info => info.FullName)
                .OrderBy(
                    value => value,
                    StringComparer.Ordinal)
                .ToList();

        List<string> materials =
            typeInfos
                .Where(
                    info =>
                        info.IsMaterial &&
                        !info.IsObsolete &&
                        !info.IsLegacyNamed)
                .Select(
                    info => info.FullName)
                .OrderBy(
                    value => value,
                    StringComparer.Ordinal)
                .ToList();

        List<string> commonMaterials =
            typeInfos
                .Where(
                    info =>
                        info.IsCommonMaterial &&
                        !info.IsObsolete &&
                        !info.IsLegacyNamed)
                .Select(
                    info => info.FullName)
                .OrderBy(
                    value => value,
                    StringComparer.Ordinal)
                .ToList();

        List<string> meshes =
            typeInfos
                .Where(
                    info =>
                        info.IsMeshProvider &&
                        !info.IsObsolete &&
                        !info.IsLegacyNamed)
                .Select(
                    info => info.FullName)
                .OrderBy(
                    value => value,
                    StringComparer.Ordinal)
                .ToList();

        List<ApiEnumInfo> enums =
            publicTypes
                .Where(
                    type =>
                        type.IsEnum &&
                        !type.ContainsGenericParameters)
                .Select(BuildEnumInfo)
                .ToList();

        List<ApiMethodInfo> slotAttachOverloads =
            FindSlotAttachMethods(
                assemblies,
                slotType)
                .Select(BuildMethodInfo)
                .OrderBy(
                    info => info.Name,
                    StringComparer.Ordinal)
                .ThenBy(
                    info => info.Signature,
                    StringComparer.Ordinal)
                .ToList();

        string engineVersion =
            typeof(Engine)
                .Assembly
                .GetName()
                .Version?
                .ToString() ??
            "unknown";

        ApiCatalog catalog =
            new()
        {
            SchemaVersion =
                CatalogSchemaVersion,
            CatalogKind =
                "live-resonite-api",
            ScannerVersion =
                ResoniteApiCatalogScannerMod.ScannerVersion,
            GeneratedAtUtc =
                DateTimeOffset.UtcNow,
            EngineVersion =
                engineVersion,
            SourceAssembly =
                typeof(Engine)
                    .Assembly
                    .GetName()
                    .Name + ".dll",
            AssemblyFingerprint =
                assemblyFingerprint,
            CatalogFingerprintVersion =
                FingerprintContractVersion,
            CatalogFingerprintAlgorithm =
                FingerprintAlgorithm,
            MethodIdentityVersion =
                ResoniteApiCatalogScannerMod
                    .MethodIdentityVersion,
            MethodIdentityAlgorithm =
                ResoniteApiCatalogScannerMod
                    .MethodIdentityAlgorithm,
            ReloadSafetyContractVersion =
                ResoniteApiCatalogScannerMod
                    .ReloadSafetyContractVersion,
            ReloadSafetyPolicy =
                ResoniteApiCatalogScannerMod
                    .ReloadSafetyPolicy,
            ReloadSafetyMinimumReaderVersion =
                ResoniteApiCatalogScannerMod
                    .ReloadSafetyMinimumReaderVersion,
            ReloadSafetyMaximumReaderVersion =
                ResoniteApiCatalogScannerMod
                    .ReloadSafetyMaximumReaderVersion,
            SuppressedDuplicateTypeDefinitions =
                suppressedDuplicateTypeDefinitions,
            Endpoint =
                _serverPort > 0
                    ? $"http://127.0.0.1:{_serverPort}/resonite_api_catalog.json"
                    : null,
            Assemblies =
                assemblyInfos,
            Components =
                components,
            Materials =
                materials,
            CommonMaterials =
                commonMaterials,
            Meshes =
                meshes,
            SlotAttachOverloads =
                slotAttachOverloads,
            Types =
                typeInfos,
            Enums =
                enums
        };

        catalog.CatalogFingerprint =
            ComputeCatalogFingerprint(
                catalog);

        return catalog;
    }

    private static ApiTypeInfo BuildTypeInfo(
        Type type,
        Type? componentBase,
        Type? workerBase,
        Type? colliderBase)
    {
        bool isComponent =
            componentBase?.IsAssignableFrom(
                type) == true;
        bool isWorker =
            workerBase?.IsAssignableFrom(
                type) == true;
        bool isCollider =
            colliderBase?.IsAssignableFrom(
                type) == true;
        bool isMaterial =
            ImplementsAssetProviderFor(
                type,
                "FrooxEngine.Material");
        bool isMeshProvider =
            ImplementsAssetProviderFor(
                type,
                "FrooxEngine.Mesh");
        bool isTextureProvider =
            ImplementsAssetProviderFor(
                type,
                "FrooxEngine.ITexture2D");
        bool isAudioProvider =
            ImplementsAssetProviderFor(
                type,
                "FrooxEngine.AudioClip");
        bool isCommonMaterial =
            ImplementsInterface(
                type,
                "FrooxEngine.ICommonMaterial");
        bool isAttachableComponent =
            isComponent &&
            !type.IsAbstract &&
            !type.ContainsGenericParameters;
        bool isUiX =
            type.Namespace?.StartsWith(
                "FrooxEngine.UIX",
                StringComparison.Ordinal) == true;
        bool isEditorNamed =
            type.Name.Contains(
                "Editor",
                StringComparison.Ordinal) ||
            type.Name.Contains(
                "Inspector",
                StringComparison.Ordinal);
        bool isToolNamed =
            type.Name.EndsWith(
                "Tool",
                StringComparison.Ordinal) ||
            type.Name.Contains(
                "Tool",
                StringComparison.Ordinal);
        bool isGizmoNamed =
            type.Name.Contains(
                "Gizmo",
                StringComparison.Ordinal);

        BindingFlags declaredPublic =
            BindingFlags.Public |
            BindingFlags.Instance |
            BindingFlags.Static |
            BindingFlags.DeclaredOnly;

        List<ApiConstructorInfo> constructors =
            SafeGetConstructors(
                type,
                declaredPublic)
                .Select(BuildConstructorInfo)
                .ToList();

        bool hasPublicParameterlessConstructor =
            type.IsValueType ||
            constructors.Any(
                constructor =>
                    constructor.Parameters.Count == 0);
        bool isPubliclyConstructible =
            !type.IsAbstract &&
            !type.IsInterface &&
            !type.ContainsGenericParameters &&
            (type.IsValueType ||
             constructors.Count > 0);

        List<ApiMethodInfo> methods =
            SafeGetMethods(
                type,
                declaredPublic)
                .Where(
                    method =>
                        !method.IsSpecialName)
                .Select(BuildMethodInfo)
                .ToList();

        List<ApiPropertyInfo> properties =
            SafeGetProperties(
                type,
                declaredPublic)
                .Select(BuildPropertyInfo)
                .ToList();

        List<ApiFieldInfo> fields =
            SafeGetFields(
                type,
                declaredPublic)
                .Select(BuildFieldInfo)
                .ToList();

        List<ApiEventInfo> events =
            SafeGetEvents(
                type,
                declaredPublic)
                .Select(BuildEventInfo)
                .ToList();

        List<string> categories =
            new();

        AddCategory(
            categories,
            isComponent,
            "component");
        AddCategory(
            categories,
            isWorker,
            "worker");
        AddCategory(
            categories,
            isMaterial,
            "material");
        AddCategory(
            categories,
            isCommonMaterial,
            "common-material");
        AddCategory(
            categories,
            isMeshProvider,
            "mesh-provider");
        AddCategory(
            categories,
            isTextureProvider,
            "texture-provider");
        AddCategory(
            categories,
            isAudioProvider,
            "audio-provider");
        AddCategory(
            categories,
            isCollider,
            "collider");
        AddCategory(
            categories,
            isUiX,
            "uix");
        AddCategory(
            categories,
            isEditorNamed,
            "editor-named");
        AddCategory(
            categories,
            isToolNamed,
            "tool-named");
        AddCategory(
            categories,
            isGizmoNamed,
            "gizmo-named");
        AddCategory(
            categories,
            type.IsEnum,
            "enum");
        AddCategory(
            categories,
            type.IsInterface,
            "interface");
        AddCategory(
            categories,
            type.IsValueType &&
            !type.IsEnum,
            "value-type");

        return new ApiTypeInfo
        {
            FullName =
                CSharpTypeName(type),
            Name =
                type.Name,
            Namespace =
                type.Namespace,
            Assembly =
                type.Assembly
                    .GetName()
                    .Name ??
                "unknown",
            ThreadAffinity =
                DetermineThreadAffinity(type),
            TypeTokenReloadSafety =
                BuildReadOnlyValueReloadSafety(),
            ReloadSafety =
                AnalyzeTypeReloadSafety(type),
            Kind =
                TypeKind(type),
            BaseType =
                type.BaseType is null
                    ? null
                    : CSharpTypeName(
                        type.BaseType),
            Interfaces =
                SafeGetInterfaces(type)
                    .Select(CSharpTypeName)
                    .OrderBy(
                        value => value,
                        StringComparer.Ordinal)
                    .ToList(),
            Categories =
                categories,
            Attributes =
                AttributeNames(type),
            IsPublic =
                IsPublicType(type),
            IsAbstract =
                type.IsAbstract,
            IsSealed =
                type.IsSealed,
            IsStatic =
                type.IsAbstract &&
                type.IsSealed,
            IsGeneric =
                type.IsGenericTypeDefinition ||
                type.ContainsGenericParameters,
            IsComponent =
                isComponent,
            IsWorker =
                isWorker,
            IsAttachableComponent =
                isAttachableComponent,
            IsMaterial =
                isMaterial,
            IsCommonMaterial =
                isCommonMaterial,
            IsMeshProvider =
                isMeshProvider,
            IsTextureProvider =
                isTextureProvider,
            IsAudioClipProvider =
                isAudioProvider,
            IsCollider =
                isCollider,
            IsUiX =
                isUiX,
            IsEditorNamed =
                isEditorNamed,
            IsToolNamed =
                isToolNamed,
            IsGizmoNamed =
                isGizmoNamed,
            IsPubliclyConstructible =
                isPubliclyConstructible,
            HasPublicParameterlessConstructor =
                hasPublicParameterlessConstructor,
            IsObsolete =
                HasAttribute(
                    type,
                    typeof(ObsoleteAttribute)
                        .FullName!),
            IsLegacyNamed =
                type.Name.StartsWith(
                    "Legacy",
                    StringComparison.Ordinal),
            IsDebugNamed =
                type.Name.StartsWith(
                    "Debug",
                    StringComparison.Ordinal) ||
                type.Namespace?.Contains(
                    ".Debug",
                    StringComparison.Ordinal) == true,
            Constructors =
                constructors,
            Methods =
                methods,
            Properties =
                properties,
            Fields =
                fields,
            Events =
                events,
            EnumValues =
                type.IsEnum
                    ? Enum.GetNames(type)
                        .ToList()
                    : null
        };
    }

    private static IEnumerable<MethodInfo> FindSlotAttachMethods(
        IEnumerable<Assembly> assemblies,
        Type? slotType)
    {
        if (slotType is null)
        {
            return Array.Empty<MethodInfo>();
        }

        List<MethodInfo> methods =
            new();

        foreach (Assembly assembly in assemblies)
        {
            foreach (Type type in GetLoadableTypes(
                         assembly))
            {
                foreach (MethodInfo method in SafeGetMethods(
                             type,
                             BindingFlags.Public |
                             BindingFlags.Static |
                             BindingFlags.Instance |
                             BindingFlags.DeclaredOnly))
                {
                    if (!method.Name.StartsWith(
                            "Attach",
                            StringComparison.Ordinal))
                    {
                        continue;
                    }

                    if (
                        method.DeclaringType == slotType &&
                        !method.IsStatic
                    )
                    {
                        methods.Add(method);
                        continue;
                    }

                    if (!method.IsStatic ||
                        !IsExtensionMethod(method) ||
                        method.DeclaringType is null ||
                        !IsPublicType(
                            method.DeclaringType))
                    {
                        continue;
                    }

                    ParameterInfo? first =
                        method.GetParameters()
                            .FirstOrDefault();

                    if (
                        first is not null &&
                        StripByRef(first.ParameterType) ==
                        slotType
                    )
                    {
                        methods.Add(method);
                    }
                }
            }
        }

        return methods
            .GroupBy(
                MethodIdentity,
                StringComparer.Ordinal)
            .Select(group => group.First());
    }

    private static ApiMethodInfo BuildMethodInfo(
        MethodInfo method)
    {
        ParameterInfo[] parameters =
            method.GetParameters();
        string id =
            ComputeSha256(
                MethodIdentity(method))
                .Substring(0, 24);

        return new ApiMethodInfo
        {
            Id = id,
            StableContractId =
                "contract.method." + id,
            Name =
                method.Name,
            DeclaringType =
                method.DeclaringType is null
                    ? "unknown"
                    : CSharpTypeName(
                        method.DeclaringType),
            Signature =
                MethodSignature(method),
            ReturnType =
                CSharpTypeName(
                    method.ReturnType),
            ReturnTypeIsValueType =
                StripByRef(
                    method.ReturnType)
                    .IsValueType,
            IsStatic =
                method.IsStatic,
            IsExtensionMethod =
                IsExtensionMethod(method),
            IsGenericMethodDefinition =
                method.IsGenericMethodDefinition,
            ThreadAffinity =
                DetermineThreadAffinity(
                    method.DeclaringType),
            GenericParameters =
                method.IsGenericMethodDefinition
                    ? method
                        .GetGenericArguments()
                        .Select(
                            BuildGenericParameterInfo)
                        .ToList()
                    : new(),
            Parameters =
                parameters
                    .Select(BuildParameterInfo)
                    .ToList(),
            ReloadSafety =
                AnalyzeMethodReloadSafety(
                    method),
            Attributes =
                AttributeNames(method),
            IsObsolete =
                HasAttribute(
                    method,
                    typeof(ObsoleteAttribute)
                        .FullName!)
        };
    }

    private static ApiConstructorInfo BuildConstructorInfo(
        ConstructorInfo constructor)
    {
        return new ApiConstructorInfo
        {
            DeclaringType =
                constructor.DeclaringType is null
                    ? "unknown"
                    : CSharpTypeName(
                        constructor.DeclaringType),
            Signature =
                ConstructorSignature(
                    constructor),
            Parameters =
                constructor
                    .GetParameters()
                    .Select(BuildParameterInfo)
                    .ToList(),
            ThreadAffinity =
                DetermineThreadAffinity(
                    constructor.DeclaringType),
            ReloadSafety =
                AnalyzeConstructorReloadSafety(
                    constructor),
            Attributes =
                AttributeNames(
                    constructor)
        };
    }

    private static ApiPropertyInfo BuildPropertyInfo(
        PropertyInfo property)
    {
        MethodInfo? getter =
            property.GetMethod;
        MethodInfo? setter =
            property.SetMethod;

        return new ApiPropertyInfo
        {
            DeclaringType =
                property.DeclaringType is null
                    ? "unknown"
                    : CSharpTypeName(
                        property.DeclaringType),
            Name =
                property.Name,
            Type =
                CSharpTypeName(
                    property.PropertyType),
            CanRead =
                getter?.IsPublic == true,
            CanWrite =
                setter?.IsPublic == true,
            IsStatic =
                getter?.IsStatic == true ||
                setter?.IsStatic == true,
            ThreadAffinity =
                DetermineThreadAffinity(
                    property.DeclaringType),
            IndexParameters =
                property
                    .GetIndexParameters()
                    .Select(BuildParameterInfo)
                    .ToList(),
            ReadReloadSafety =
                AnalyzePropertyReadReloadSafety(
                    property),
            WriteReloadSafety =
                AnalyzePropertyWriteReloadSafety(
                    property),
            Attributes =
                AttributeNames(property),
            IsObsolete =
                HasAttribute(
                    property,
                    typeof(ObsoleteAttribute)
                        .FullName!)
        };
    }

    private static ApiFieldInfo BuildFieldInfo(
        FieldInfo field)
    {
        string? constantValue = null;

        if (field.IsLiteral)
        {
            try
            {
                constantValue =
                    CSharpLiteral(
                        field.GetRawConstantValue(),
                        field.FieldType);
            }
            catch
            {
            }
        }

        return new ApiFieldInfo
        {
            DeclaringType =
                field.DeclaringType is null
                    ? "unknown"
                    : CSharpTypeName(
                        field.DeclaringType),
            Name =
                field.Name,
            Type =
                CSharpTypeName(
                    field.FieldType),
            IsStatic =
                field.IsStatic,
            IsReadOnly =
                field.IsInitOnly,
            IsConst =
                field.IsLiteral,
            ThreadAffinity =
                DetermineThreadAffinity(
                    field.DeclaringType),
            ConstantValueCSharp =
                constantValue,
            ReadReloadSafety =
                AnalyzeFieldReadReloadSafety(
                    field),
            WriteReloadSafety =
                AnalyzeFieldWriteReloadSafety(
                    field),
            Attributes =
                AttributeNames(field),
            IsObsolete =
                HasAttribute(
                    field,
                    typeof(ObsoleteAttribute)
                        .FullName!)
        };
    }

    private static ApiEventInfo BuildEventInfo(
        EventInfo eventInfo)
    {
        MethodInfo? add =
            eventInfo.AddMethod;
        MethodInfo? remove =
            eventInfo.RemoveMethod;

        return new ApiEventInfo
        {
            DeclaringType =
                eventInfo.DeclaringType is null
                    ? "unknown"
                    : CSharpTypeName(
                        eventInfo.DeclaringType),
            Name =
                eventInfo.Name,
            HandlerType =
                eventInfo.EventHandlerType is null
                    ? null
                    : CSharpTypeName(
                        eventInfo.EventHandlerType),
            IsStatic =
                add?.IsStatic == true ||
                remove?.IsStatic == true,
            ThreadAffinity =
                DetermineThreadAffinity(
                    eventInfo.DeclaringType),
            ReloadSafety =
                AnalyzeEventReloadSafety(
                    eventInfo),
            Attributes =
                AttributeNames(eventInfo),
            IsObsolete =
                HasAttribute(
                    eventInfo,
                    typeof(ObsoleteAttribute)
                        .FullName!)
        };
    }

    private static string DetermineThreadAffinity(
        Type? declaringType)
    {
        if (declaringType is null)
        {
            return "unknown";
        }

        string assemblyName =
            declaringType.Assembly
                .GetName()
                .Name ??
            "";
        string namespaceName =
            declaringType.Namespace ??
            "";

        if (assemblyName.Equals(
                "FrooxEngine",
                StringComparison.Ordinal) ||
            namespaceName.StartsWith(
                "FrooxEngine",
                StringComparison.Ordinal))
        {
            return "world";
        }

        if (assemblyName.StartsWith(
                "Renderite.",
                StringComparison.Ordinal) ||
            namespaceName.StartsWith(
                "Renderite.",
                StringComparison.Ordinal))
        {
            return "render";
        }

        if (assemblyName.Equals(
                "Elements.Core",
                StringComparison.Ordinal) ||
            namespaceName.StartsWith(
                "Elements.Core",
                StringComparison.Ordinal) ||
            namespaceName.Equals(
                "System",
                StringComparison.Ordinal) ||
            namespaceName.StartsWith(
                "System.",
                StringComparison.Ordinal) ||
            namespaceName.StartsWith(
                "Microsoft.",
                StringComparison.Ordinal) ||
            namespaceName.StartsWith(
                "Newtonsoft.",
                StringComparison.Ordinal) ||
            namespaceName.StartsWith(
                "HarmonyLib",
                StringComparison.Ordinal))
        {
            return "any";
        }

        return "unknown";
    }

    private static ApiReloadSafetyInfo AnalyzeTypeReloadSafety(
        Type type)
    {
        _ = type;

        // Merely loading or resolving a host type does not create a
        // host-to-mod reference. Construction and lifetime operations are
        // represented by their own constructor/method contracts.
        return BuildReadOnlyValueReloadSafety();
    }

    private static ApiReloadSafetyInfo AnalyzeMethodReloadSafety(
        MethodInfo method)
    {
        ReloadSafetyAccumulator analysis =
            new("invoke");

        ApplyDeclaringTypeReloadRules(
            analysis,
            method.DeclaringType);

        if ((method.Attributes &
             MethodAttributes.PinvokeImpl) != 0 ||
            HasAttribute(
                method,
                "System.Runtime.InteropServices.UnmanagedCallersOnlyAttribute"))
        {
            analysis.Add(
                "unsafe",
                "native-entrypoint",
                "process-restart",
                retainsCallerObjects: null);
        }

        bool retentionNamed =
            LooksLikeRetentionMember(
                method.Name);
        RetentionBodyAnalysis retentionBody =
            MethodBodyMayRetainCallerValue(
                method,
                includeInstanceStores: true);
        bool mayRetain =
            retentionNamed ||
            retentionBody ==
                RetentionBodyAnalysis.RetentionPath;
        bool opaqueBody =
            retentionBody ==
                RetentionBodyAnalysis.Opaque;
        bool carrierParameterWasAnalyzed = false;

        foreach (ParameterInfo parameter in
                 method.GetParameters())
        {
            Type parameterType =
                StripByRef(
                    parameter.ParameterType);

            if (!CanCarryModDefinedReference(
                    parameterType))
            {
                continue;
            }
            carrierParameterWasAnalyzed = true;

            if (opaqueBody &&
                (method.IsAbstract ||
                 method.DeclaringType?.IsInterface == true ||
                 IsDelegateType(
                     method.DeclaringType ??
                     typeof(void)) ||
                 method.ContainsGenericParameters ||
                 method.DeclaringType?.ContainsGenericParameters == true))
            {
                analysis.Add(
                    "conditional",
                    IsDelegateType(
                        method.DeclaringType ??
                        typeof(void))
                        ? "delegate-target-selected-at-use-site"
                        : "implementation-selected-at-use-site",
                    "host-reference-release",
                    retainsCallerObjects: true);
                analysis.RequireUseSiteResolution(
                    "runtime-implementation",
                    "closed-generic-arguments",
                    "actual-argument-type",
                    "cleanup-path");
                continue;
            }

            if (opaqueBody)
            {
                analysis.Add(
                    "unknown",
                    "opaque-body-may-retain-caller-value",
                    "host-reference-release",
                    retainsCallerObjects: true);
                analysis.RequireExecutionProof();
                continue;
            }

            if (mayRetain)
            {
                string cleanup =
                    ContainsDelegateType(parameterType)
                        ? "callback-release"
                        : "host-reference-release";
                analysis.Add(
                    "conditional",
                    "retention-shaped-member-may-store-caller-object",
                    cleanup,
                    retainsCallerObjects: true);
                analysis.RequireUseSiteResolution(
                    "actual-argument-type",
                    method.IsStatic
                        ? "static-operation"
                        : "receiver-lifetime",
                    "cleanup-path");
            }
        }

        bool genericArgumentCanCarryModType =
            method.ContainsGenericParameters ||
            method.DeclaringType?.ContainsGenericParameters == true;
        bool receiverCanBeModDefined =
            !method.IsStatic &&
            method.DeclaringType is not null &&
            CanCarryModDefinedReference(
                method.DeclaringType);
        if (!carrierParameterWasAnalyzed &&
            (genericArgumentCanCarryModType ||
             receiverCanBeModDefined) &&
            retentionBody ==
                RetentionBodyAnalysis.RetentionPath)
        {
            analysis.Add(
                "conditional",
                genericArgumentCanCarryModType
                    ? "closed-generic-type-may-be-published-to-host-storage"
                    : "instance-receiver-may-be-published-to-host-storage",
                "host-reference-release",
                retainsCallerObjects: true);
            analysis.RequireUseSiteResolution(
                genericArgumentCanCarryModType
                    ? "closed-generic-arguments"
                    : "receiver-runtime-type",
                method.IsStatic
                    ? "static-operation"
                    : "receiver-lifetime",
                "cleanup-path");
        }
        else if (!carrierParameterWasAnalyzed &&
                 (genericArgumentCanCarryModType ||
                  receiverCanBeModDefined) &&
                 opaqueBody)
        {
            analysis.Add(
                "conditional",
                genericArgumentCanCarryModType
                    ? "opaque-generic-implementation-selected-at-use-site"
                    : "opaque-instance-implementation-selected-at-use-site",
                "host-reference-release",
                retainsCallerObjects: true);
            analysis.RequireUseSiteResolution(
                genericArgumentCanCarryModType
                    ? "closed-generic-arguments"
                    : "receiver-runtime-type",
                "runtime-implementation",
                "cleanup-path");
        }

        Type returnType =
            StripByRef(
                method.ReturnType);

        if (IsTaskLikeType(returnType))
        {
            analysis.Add(
                "conditional",
                "asynchronous-result",
                "task-drain",
                retainsCallerObjects: true);
            analysis.RequireUseSiteResolution(
                "result-lifetime");
        }

        if (IsBackgroundLifetimeType(returnType))
        {
            analysis.Add(
                "conditional",
                "background-lifetime-result",
                "stop-cancel-dispose",
                retainsCallerObjects: true);
            analysis.RequireUseSiteResolution(
                "result-lifetime");
        }

        return analysis.Build();
    }

    private static ApiReloadSafetyInfo AnalyzeConstructorReloadSafety(
        ConstructorInfo constructor)
    {
        ReloadSafetyAccumulator analysis =
            new("construct");

        ApplyDeclaringTypeReloadRules(
            analysis,
            constructor.DeclaringType);

        if (constructor.DeclaringType is not null &&
            IsDelegateType(
                constructor.DeclaringType))
        {
            analysis.Add(
                "conditional",
                "delegate-construction-captures-target",
                "callback-release",
                retainsCallerObjects: true);
            analysis.RequireUseSiteResolution(
                "target-origin",
                "constructed-delegate-lifetime",
                "cleanup-path");
            return analysis.Build();
        }

        if (constructor.DeclaringType is not null &&
            IsBackgroundLifetimeType(
                constructor.DeclaringType))
        {
            analysis.Add(
                "conditional",
                "background-lifetime-construction",
                "stop-cancel-dispose",
                retainsCallerObjects: true);
            analysis.RequireUseSiteResolution(
                "constructed-object-lifetime");
        }

        RetentionBodyAnalysis constructionBody =
            MethodBodyMayRetainCallerValue(
                constructor,
                includeInstanceStores: false);

        if (constructionBody !=
            RetentionBodyAnalysis.NoRetention)
        {
            foreach (ParameterInfo parameter in
                     constructor.GetParameters())
            {
                Type parameterType =
                    StripByRef(
                        parameter.ParameterType);

                if (CanCarryModDefinedReference(
                        parameterType))
                {
                    bool opaque =
                        constructionBody ==
                            RetentionBodyAnalysis.Opaque;
                    bool openGenericUseSite =
                        opaque &&
                        constructor.DeclaringType?
                            .ContainsGenericParameters == true;
                    analysis.Add(
                        opaque &&
                        !openGenericUseSite
                            ? "unknown"
                            : "conditional",
                        opaque &&
                        !openGenericUseSite
                            ? "opaque-constructor-may-retain-caller-value"
                            : openGenericUseSite
                                ? "closed-constructor-selected-at-use-site"
                                : "constructor-may-publish-caller-object",
                        "host-reference-release",
                        retainsCallerObjects: true);
                    if (opaque &&
                        !openGenericUseSite)
                    {
                        analysis.RequireExecutionProof();
                    }
                    else
                    {
                        analysis.RequireUseSiteResolution(
                            "closed-generic-arguments",
                            "actual-argument-type",
                            "constructed-object-lifetime",
                            "cleanup-path");
                    }
                }
            }
        }

        return analysis.Build();
    }

    private static ApiReloadSafetyInfo AnalyzePropertyReadReloadSafety(
        PropertyInfo property)
    {
        _ = property;
        return BuildReadOnlyValueReloadSafety();
    }

    private static ApiReloadSafetyInfo AnalyzePropertyWriteReloadSafety(
        PropertyInfo property)
    {
        ReloadSafetyAccumulator analysis =
            new("write");

        ApplyDeclaringTypeReloadRules(
            analysis,
            property.DeclaringType);
        ApplyHostWriteReloadRules(
            analysis,
            property.PropertyType,
            property.SetMethod?.IsStatic == true,
            "property");

        return analysis.Build();
    }

    private static ApiReloadSafetyInfo AnalyzeFieldReadReloadSafety(
        FieldInfo field)
    {
        _ = field;
        return BuildReadOnlyValueReloadSafety();
    }

    private static ApiReloadSafetyInfo AnalyzeFieldWriteReloadSafety(
        FieldInfo field)
    {
        ReloadSafetyAccumulator analysis =
            new("write");

        ApplyDeclaringTypeReloadRules(
            analysis,
            field.DeclaringType);
        ApplyHostWriteReloadRules(
            analysis,
            field.FieldType,
            field.IsStatic,
            "field");

        return analysis.Build();
    }

    private static ApiReloadSafetyInfo AnalyzeEventReloadSafety(
        EventInfo eventInfo)
    {
        ReloadSafetyAccumulator analysis =
            new("subscribe");

        ApplyDeclaringTypeReloadRules(
            analysis,
            eventInfo.DeclaringType);
        analysis.Add(
            "conditional",
            eventInfo.AddMethod?.IsStatic == true
                ? "static-event-subscription"
                : "event-subscription",
            "event-unsubscribe",
            retainsCallerObjects: true);
        analysis.RequireUseSiteResolution(
            "handler-origin",
            "subscription-lifetime",
            "cleanup-path");

        return analysis.Build();
    }

    private static void ApplyDeclaringTypeReloadRules(
        ReloadSafetyAccumulator analysis,
        Type? declaringType)
    {
        string fullName =
            declaringType?.FullName ??
            "";
        string namespaceName =
            declaringType?.Namespace ??
            "";

        if (namespaceName.StartsWith(
                "HarmonyLib",
                StringComparison.Ordinal))
        {
            analysis.Add(
                "unsafe",
                "runtime-code-patching",
                "process-restart",
                retainsCallerObjects: true);
        }

        if (namespaceName.StartsWith(
                "System.Reflection.Emit",
                StringComparison.Ordinal) ||
            namespaceName.StartsWith(
                "System.Runtime.Loader",
                StringComparison.Ordinal) ||
            fullName.Equals(
                "System.AppDomain",
                StringComparison.Ordinal))
        {
            analysis.Add(
                "unsafe",
                "runtime-loader-or-emitted-code",
                "process-restart",
                retainsCallerObjects: true);
        }
    }

    private static void ApplyHostWriteReloadRules(
        ReloadSafetyAccumulator analysis,
        Type valueType,
        bool isStatic,
        string memberKind)
    {
        Type stripped =
            StripByRef(valueType);

        if (ContainsDelegateType(stripped))
        {
            analysis.Add(
                "conditional",
                isStatic
                    ? $"static-{memberKind}-stores-callback"
                    : $"instance-{memberKind}-stores-callback",
                "callback-release",
                retainsCallerObjects: true);
            analysis.RequireUseSiteResolution(
                "value-origin",
                isStatic
                    ? "static-storage"
                    : "receiver-lifetime",
                "cleanup-path");
        }

        if (ContainsReflectionTokenType(stripped))
        {
            analysis.Add(
                "conditional",
                isStatic
                    ? $"static-{memberKind}-stores-reflection-token"
                    : $"instance-{memberKind}-may-store-reflection-token",
                "host-reference-release",
                retainsCallerObjects: true);
            analysis.RequireUseSiteResolution(
                "value-origin",
                isStatic
                    ? "static-storage"
                    : "receiver-lifetime");
        }


        if (IsBackgroundLifetimeType(stripped))
        {
            analysis.Add(
                "conditional",
                isStatic
                    ? $"static-{memberKind}-stores-background-lifetime"
                    : $"instance-{memberKind}-stores-background-lifetime",
                "stop-cancel-dispose",
                retainsCallerObjects: true);
            analysis.RequireUseSiteResolution(
                "value-origin",
                isStatic
                    ? "static-storage"
                    : "receiver-lifetime",
                "cleanup-path");
        }

        if (CanCarryModDefinedReference(stripped) &&
            !ContainsDelegateType(stripped) &&
            !ContainsReflectionTokenType(stripped) &&
            !IsBackgroundLifetimeType(stripped))
        {
            analysis.Add(
                "conditional",
                isStatic
                    ? $"static-{memberKind}-may-store-mod-defined-reference"
                    : $"instance-{memberKind}-may-store-mod-defined-reference",
                "host-reference-release",
                retainsCallerObjects: true);
            analysis.RequireUseSiteResolution(
                "value-origin",
                isStatic
                    ? "static-storage"
                    : "receiver-lifetime");
        }
    }

    private static bool CanCarryModDefinedReference(
        Type type)
    {
        Type stripped =
            StripByRef(type);
        lock (ValueCarrierCacheLock)
        {
            if (ValueCarrierCache.TryGetValue(
                    stripped,
                    out bool cached))
            {
                return cached;
            }
        }

        bool result =
            CanCarryModDefinedReference(
                stripped,
                new HashSet<Type>(),
                0);
        lock (ValueCarrierCacheLock)
        {
            ValueCarrierCache[stripped] = result;
        }
        return result;
    }

    private static bool CanCarryModDefinedReference(
        Type type,
        HashSet<Type> visited,
        int depth)
    {
        Type stripped =
            StripByRef(type);

        if (depth > 12)
        {
            return true;
        }

        if (stripped == typeof(string) ||
            stripped.IsPrimitive ||
            stripped.IsEnum ||
            stripped.IsPointer ||
            stripped == typeof(decimal) ||
            stripped == typeof(DateTime) ||
            stripped == typeof(DateTimeOffset) ||
            stripped == typeof(TimeSpan) ||
            stripped == typeof(Guid) ||
            stripped == typeof(IntPtr) ||
            stripped == typeof(UIntPtr))
        {
            return false;
        }

        if (stripped.IsGenericParameter ||
            stripped == typeof(object) ||
            stripped.IsInterface ||
            stripped.IsAbstract ||
            IsDelegateType(stripped) ||
            ContainsReflectionTokenTypeLeaf(stripped) ||
            IsBackgroundLifetimeType(stripped))
        {
            return true;
        }

        if (!visited.Add(stripped))
        {
            return false;
        }

        try
        {
            if (stripped.HasElementType &&
                stripped.GetElementType() is Type elementType)
            {
                return CanCarryModDefinedReference(
                    elementType,
                    visited,
                    depth + 1);
            }

            if (stripped.IsGenericType &&
                stripped.GetGenericArguments()
                    .Any(argument =>
                        CanCarryModDefinedReference(
                            argument,
                            visited,
                            depth + 1)))
            {
                return true;
            }

            if (stripped.IsValueType)
            {
                return stripped.GetFields(
                        BindingFlags.Public |
                        BindingFlags.NonPublic |
                        BindingFlags.Instance)
                    .Any(field =>
                        CanCarryModDefinedReference(
                            field.FieldType,
                            visited,
                            depth + 1));
            }

            // A sealed external reference type cannot itself be replaced by a
            // mod-defined subtype. Any later write into that object's own
            // storage is represented by a separate operation contract.
            return !stripped.IsSealed;
        }
        catch
        {
            // Failure to inspect a value closure must remain conservative.
            return true;
        }
        finally
        {
            visited.Remove(stripped);
        }
    }

    private static bool ContainsReflectionTokenTypeLeaf(
        Type candidate)
    {
        string fullName =
            candidate.FullName ??
            "";

        return
            fullName.Equals(
                "System.Type",
                StringComparison.Ordinal) ||
            fullName.StartsWith(
                "System.Reflection.",
                StringComparison.Ordinal);
    }

    private enum RetentionBodyAnalysis
    {
        NoRetention,
        RetentionPath,
        Opaque
    }

    private static RetentionBodyAnalysis
        MethodBodyMayRetainCallerValue(
        MethodBase method,
        bool includeInstanceStores)
    {
        bool hasCarrierInput =
            method.GetParameters()
                .Any(parameter =>
                    CanCarryModDefinedReference(
                        parameter.ParameterType)) ||
            method.ContainsGenericParameters ||
            method.DeclaringType?.ContainsGenericParameters == true ||
            (!method.IsStatic &&
             method.DeclaringType is not null &&
             CanCarryModDefinedReference(
                 method.DeclaringType));
        if (!hasCarrierInput)
        {
            return RetentionBodyAnalysis.NoRetention;
        }

        MethodBody? body;
        try
        {
            body = method.GetMethodBody();
        }
        catch
        {
            return RetentionBodyAnalysis.Opaque;
        }

        byte[]? bytes =
            body?.GetILAsByteArray();
        if (bytes is null)
        {
            // Abstract, runtime-provided and otherwise opaque bodies cannot
            // be proven safe from their signature alone.
            return RetentionBodyAnalysis.Opaque;
        }

        Type[]? typeArguments =
            method.DeclaringType?.IsGenericType == true
                ? method.DeclaringType.GetGenericArguments()
                : null;
        Type[]? methodArguments =
            method.IsGenericMethod
                ? method.GetGenericArguments()
                : null;

        int offset = 0;
        while (offset < bytes.Length)
        {
            int opcodeValue =
                bytes[offset++];
            if (opcodeValue == 0xFE)
            {
                if (offset >= bytes.Length)
                {
                    return RetentionBodyAnalysis.Opaque;
                }
                opcodeValue =
                    unchecked(
                        (short)(0xFE00 |
                                bytes[offset++]));
            }

            if (!IlOpCodes.TryGetValue(
                    unchecked((short)opcodeValue),
                    out OpCode opcode))
            {
                return RetentionBodyAnalysis.Opaque;
            }

            int operandOffset = offset;
            int operandSize =
                IlOperandSize(
                    opcode.OperandType,
                    bytes,
                    operandOffset);
            if (operandSize < 0 ||
                operandOffset + operandSize >
                bytes.Length)
            {
                return RetentionBodyAnalysis.Opaque;
            }

            if (opcode == OpCodes.Stsfld ||
                (includeInstanceStores &&
                 opcode == OpCodes.Stfld))
            {
                FieldInfo? field =
                    ResolveIlMember(
                        method,
                        bytes,
                        operandOffset,
                        typeArguments,
                        methodArguments) as FieldInfo;
                if (field is null ||
                    CanCarryModDefinedReference(
                        field.FieldType))
                {
                    return RetentionBodyAnalysis.RetentionPath;
                }
            }
            else if (opcode == OpCodes.Call ||
                     opcode == OpCodes.Callvirt ||
                     opcode == OpCodes.Newobj)
            {
                MethodBase? called =
                    ResolveIlMember(
                        method,
                        bytes,
                        operandOffset,
                        typeArguments,
                        methodArguments) as MethodBase;
                if (called is null)
                {
                    return RetentionBodyAnalysis.Opaque;
                }

                if (IsKnownRetentionSink(called) &&
                    called.GetParameters()
                        .Any(parameter =>
                            CanCarryModDefinedReference(
                                parameter.ParameterType)))
                {
                    return RetentionBodyAnalysis.RetentionPath;
                }
            }
            else if (opcode == OpCodes.Calli)
            {
                // An indirect call has no resolvable target. With a
                // caller-value carrier in the signature it cannot be
                // declared structurally safe.
                return RetentionBodyAnalysis.Opaque;
            }

            offset += operandSize;
        }

        return RetentionBodyAnalysis.NoRetention;
    }

    private static bool IsKnownRetentionSink(
        MethodBase method)
    {
        string name = method.Name;
        string owner =
            method.DeclaringType?.IsGenericType == true
                ? method.DeclaringType
                    .GetGenericTypeDefinition()
                    .FullName ??
                  ""
                : method.DeclaringType?.FullName ??
                  "";

        if (name.StartsWith(
                "add_",
                StringComparison.Ordinal) ||
            LooksLikeRetentionMember(name))
        {
            return true;
        }

        if (owner.Equals(
                "System.Threading.Tasks.Task",
                StringComparison.Ordinal) &&
            name.Equals(
                "Run",
                StringComparison.Ordinal))
        {
            return true;
        }

        if ((owner.Equals(
                 "System.Threading.Tasks.TaskFactory",
                 StringComparison.Ordinal) ||
             owner.StartsWith(
                 "System.Threading.Tasks.TaskFactory`",
                 StringComparison.Ordinal)) &&
            name.Equals(
                "StartNew",
                StringComparison.Ordinal))
        {
            return true;
        }

        if (owner.Equals(
                "System.Threading.ThreadPool",
                StringComparison.Ordinal) &&
            name is
                "QueueUserWorkItem" or
                "UnsafeQueueUserWorkItem" or
                "RegisterWaitForSingleObject")
        {
            return true;
        }

        if (owner.Equals(
                "System.Threading.CancellationToken",
                StringComparison.Ordinal) &&
            name.Equals(
                "Register",
                StringComparison.Ordinal))
        {
            return true;
        }

        if ((owner.Equals(
                 "System.Threading.Timer",
                 StringComparison.Ordinal) ||
             owner.Equals(
                 "System.Threading.Thread",
                 StringComparison.Ordinal)) &&
            name.Equals(
                ".ctor",
                StringComparison.Ordinal))
        {
            return true;
        }

        if ((owner.Equals(
                 "System.Threading.Tasks.Task",
                 StringComparison.Ordinal) ||
             owner.StartsWith(
                 "System.Threading.Tasks.Task`",
                 StringComparison.Ordinal)) &&
            name.Equals(
                "ContinueWith",
                StringComparison.Ordinal))
        {
            return true;
        }

        if (owner.Equals(
                "System.Threading.Interlocked",
                StringComparison.Ordinal) &&
            name is
                "Exchange" or
                "CompareExchange")
        {
            return true;
        }

        return
            owner.Equals(
                "System.Threading.Volatile",
                StringComparison.Ordinal) &&
            name.Equals(
                "Write",
                StringComparison.Ordinal);
    }

    private static MemberInfo? ResolveIlMember(
        MethodBase source,
        byte[] bytes,
        int operandOffset,
        Type[]? typeArguments,
        Type[]? methodArguments)
    {
        try
        {
            int token =
                BitConverter.ToInt32(
                    bytes,
                    operandOffset);
            return source.Module.ResolveMember(
                token,
                typeArguments,
                methodArguments);
        }
        catch
        {
            return null;
        }
    }

    private static int IlOperandSize(
        OperandType operandType,
        byte[] bytes,
        int operandOffset)
    {
        return operandType switch
        {
            OperandType.InlineNone => 0,
            OperandType.ShortInlineBrTarget or
            OperandType.ShortInlineI or
            OperandType.ShortInlineVar => 1,
            OperandType.InlineVar => 2,
            OperandType.InlineBrTarget or
            OperandType.InlineField or
            OperandType.InlineI or
            OperandType.InlineMethod or
            OperandType.InlineSig or
            OperandType.InlineString or
            OperandType.InlineTok or
            OperandType.InlineType or
            OperandType.ShortInlineR => 4,
            OperandType.InlineI8 or
            OperandType.InlineR => 8,
            OperandType.InlineSwitch =>
                operandOffset + 4 <= bytes.Length
                    ? checked(
                        4 +
                        BitConverter.ToInt32(
                            bytes,
                            operandOffset) * 4)
                    : -1,
            _ => -1
        };
    }

    private static bool LooksLikeRetentionMember(
        string name)
    {
        return
            name.StartsWith(
                "Register",
                StringComparison.Ordinal) ||
            name.StartsWith(
                "Subscribe",
                StringComparison.Ordinal) ||
            name.StartsWith(
                "Observe",
                StringComparison.Ordinal) ||
            name.StartsWith(
                "Watch",
                StringComparison.Ordinal) ||
            name.StartsWith(
                "Hook",
                StringComparison.Ordinal) ||
            name.StartsWith(
                "Cache",
                StringComparison.Ordinal) ||
            name.StartsWith(
                "Store",
                StringComparison.Ordinal) ||
            name.StartsWith(
                "Add",
                StringComparison.Ordinal) ||
            name.StartsWith(
                "TryAdd",
                StringComparison.Ordinal) ||
            name.StartsWith(
                "GetOrAdd",
                StringComparison.Ordinal) ||
            name.StartsWith(
                "TryUpdate",
                StringComparison.Ordinal) ||
            name.StartsWith(
                "Set",
                StringComparison.Ordinal) ||
            name.StartsWith(
                "Assign",
                StringComparison.Ordinal) ||
            name.StartsWith(
                "Insert",
                StringComparison.Ordinal) ||
            name.StartsWith(
                "Enqueue",
                StringComparison.Ordinal) ||
            name.StartsWith(
                "Push",
                StringComparison.Ordinal) ||
            name.StartsWith(
                "Track",
                StringComparison.Ordinal) ||
            name.StartsWith(
                "Bind",
                StringComparison.Ordinal) ||
            name.StartsWith(
                "set_",
                StringComparison.Ordinal) ||
            name.Contains(
                "Callback",
                StringComparison.Ordinal) ||
            name.Contains(
                "Listener",
                StringComparison.Ordinal) ||
            name.Contains(
                "Handler",
                StringComparison.Ordinal);
    }

    private static bool ContainsDelegateType(
        Type type)
    {
        return ContainsType(
            type,
            IsDelegateType);
    }

    private static bool IsDelegateType(
        Type type)
    {
        try
        {
            return typeof(Delegate)
                .IsAssignableFrom(
                    StripByRef(type));
        }
        catch
        {
            return false;
        }
    }

    private static bool ContainsReflectionTokenType(
        Type type)
    {
        return ContainsType(
            type,
            candidate =>
            {
                string fullName =
                    candidate.FullName ??
                    "";

                return
                    fullName.Equals(
                        "System.Type",
                        StringComparison.Ordinal) ||
                    fullName.Equals(
                        "System.Reflection.MemberInfo",
                        StringComparison.Ordinal) ||
                    fullName.Equals(
                        "System.Reflection.MethodBase",
                        StringComparison.Ordinal) ||
                    fullName.Equals(
                        "System.Reflection.MethodInfo",
                        StringComparison.Ordinal) ||
                    fullName.Equals(
                        "System.Reflection.ConstructorInfo",
                        StringComparison.Ordinal) ||
                    fullName.Equals(
                        "System.Reflection.PropertyInfo",
                        StringComparison.Ordinal) ||
                    fullName.Equals(
                        "System.Reflection.FieldInfo",
                        StringComparison.Ordinal) ||
                    fullName.Equals(
                        "System.Reflection.EventInfo",
                        StringComparison.Ordinal) ||
                    fullName.Equals(
                        "System.Reflection.Assembly",
                        StringComparison.Ordinal) ||
                    fullName.Equals(
                        "System.Reflection.Module",
                        StringComparison.Ordinal);
            });
    }

    private static bool IsTaskLikeType(
        Type type)
    {
        Type stripped =
            StripByRef(type);
        string fullName =
            stripped.IsGenericType
                ? stripped.GetGenericTypeDefinition()
                    .FullName ??
                  ""
                : stripped.FullName ??
                  "";

        return
            fullName.Equals(
                "System.Threading.Tasks.Task",
                StringComparison.Ordinal) ||
            fullName.Equals(
                "System.Threading.Tasks.Task`1",
                StringComparison.Ordinal) ||
            fullName.Equals(
                "System.Threading.Tasks.ValueTask",
                StringComparison.Ordinal) ||
            fullName.Equals(
                "System.Threading.Tasks.ValueTask`1",
                StringComparison.Ordinal);
    }

    private static bool IsBackgroundLifetimeType(
        Type type)
    {
        Type stripped =
            StripByRef(type);
        string fullName =
            stripped.IsGenericType
                ? stripped.GetGenericTypeDefinition()
                    .FullName ??
                  ""
                : stripped.FullName ??
                  "";

        return
            IsTaskLikeType(stripped) ||
            fullName.Equals(
                "System.Threading.Thread",
                StringComparison.Ordinal) ||
            fullName.Equals(
                "System.Threading.Timer",
                StringComparison.Ordinal) ||
            fullName.Equals(
                "System.Timers.Timer",
                StringComparison.Ordinal) ||
            fullName.Equals(
                "System.Threading.PeriodicTimer",
                StringComparison.Ordinal) ||
            fullName.Equals(
                "System.Threading.CancellationTokenSource",
                StringComparison.Ordinal);
    }

    private static bool ContainsType(
        Type type,
        Func<Type, bool> predicate)
    {
        Type stripped =
            StripByRef(type);

        if (predicate(stripped))
        {
            return true;
        }

        if (stripped.HasElementType &&
            stripped.GetElementType() is Type elementType &&
            ContainsType(
                elementType,
                predicate))
        {
            return true;
        }

        if (!stripped.IsGenericType)
        {
            return false;
        }

        try
        {
            return stripped
                .GetGenericArguments()
                .Any(argument =>
                    ContainsType(
                        argument,
                        predicate));
        }
        catch
        {
            return false;
        }
    }

    private static ApiParameterInfo BuildParameterInfo(
        ParameterInfo parameter)
    {
        Type stripped =
            StripByRef(
                parameter.ParameterType);

        return new ApiParameterInfo
        {
            Name =
                parameter.Name ??
                $"arg{parameter.Position}",
            Position =
                parameter.Position,
            Type =
                CSharpTypeName(
                    parameter.ParameterType),
            ElementType =
                CSharpTypeName(stripped),
            IsOut =
                parameter.IsOut,
            IsByRef =
                parameter.ParameterType.IsByRef,
            IsIn =
                parameter.IsIn,
            IsOptional =
                parameter.IsOptional,
            HasDefaultValue =
                parameter.HasDefaultValue,
            DefaultValueCSharp =
                parameter.HasDefaultValue
                    ? ParameterDefaultCSharp(
                        parameter)
                    : null,
            Attributes =
                AttributeNames(parameter)
        };
    }

    private static ApiGenericParameterInfo BuildGenericParameterInfo(
        Type parameter)
    {
        GenericParameterAttributes attributes =
            parameter.GenericParameterAttributes;

        return new ApiGenericParameterInfo
        {
            Name =
                parameter.Name,
            Position =
                parameter.GenericParameterPosition,
            Constraints =
                parameter
                    .GetGenericParameterConstraints()
                    .Select(CSharpTypeName)
                    .ToList(),
            ReferenceTypeConstraint =
                attributes.HasFlag(
                    GenericParameterAttributes.ReferenceTypeConstraint),
            ValueTypeConstraint =
                attributes.HasFlag(
                    GenericParameterAttributes.NotNullableValueTypeConstraint),
            DefaultConstructorConstraint =
                attributes.HasFlag(
                    GenericParameterAttributes.DefaultConstructorConstraint)
        };
    }

    private static ApiEnumInfo BuildEnumInfo(
        Type type)
    {
        List<ApiEnumValueInfo> values =
            new();

        foreach (string name in Enum.GetNames(type))
        {
            object value =
                Enum.Parse(type, name);

            values.Add(
                new ApiEnumValueInfo
                {
                    Name = name,
                    NumericValue =
                        Convert.ToString(
                            Convert.ChangeType(
                                value,
                                Enum.GetUnderlyingType(type),
                                CultureInfo.InvariantCulture),
                            CultureInfo.InvariantCulture) ??
                        "0"
                });
        }

        return new ApiEnumInfo
        {
            FullName =
                CSharpTypeName(type),
            ThreadAffinity =
                DetermineThreadAffinity(type),
            ValueReloadSafety =
                BuildReadOnlyValueReloadSafety(),
            UnderlyingType =
                CSharpTypeName(
                    Enum.GetUnderlyingType(type)),
            Values = values,
            IsFlags =
                HasAttribute(
                    type,
                    typeof(FlagsAttribute)
                        .FullName!),
            IsObsolete =
                HasAttribute(
                    type,
                    typeof(ObsoleteAttribute)
                        .FullName!)
        };
    }

    private static ApiAssemblyInfo BuildAssemblyInfo(
        Assembly assembly)
    {
        AssemblyName name =
            assembly.GetName();
        string? location = null;

        try
        {
            if (!string.IsNullOrWhiteSpace(assembly.Location))
            {
                string baseDirectory =
                    Path.GetFullPath(AppContext.BaseDirectory);
                string fullLocation =
                    Path.GetFullPath(assembly.Location);

                string relative =
                    Path.GetRelativePath(
                        baseDirectory,
                        fullLocation);

                location =
                    relative.StartsWith(".." + Path.DirectorySeparatorChar, StringComparison.Ordinal) ||
                    relative.Equals("..", StringComparison.Ordinal)
                        ? Path.GetFileName(fullLocation)
                        : relative.Replace(
                            Path.DirectorySeparatorChar,
                            '/');
            }
        }
        catch
        {
        }

        string mvid =
            "";

        try
        {
            mvid = string.Join(
                ",",
                assembly
                    .GetModules()
                    .Select(
                        module =>
                            module.ModuleVersionId
                                .ToString("D"))
                    .OrderBy(
                        value => value,
                        StringComparer.Ordinal));
        }
        catch
        {
        }

        return new ApiAssemblyInfo
        {
            Name =
                name.Name ??
                "unknown",
            Version =
                name.Version?
                    .ToString() ??
                "unknown",
            FullName =
                assembly.FullName ??
                name.FullName,
            Location =
                location,
            ModuleVersionIds =
                mvid
                    .Split(
                        ',',
                        StringSplitOptions.RemoveEmptyEntries)
                    .ToList()
        };
    }

    private static ApiReloadSafetyInfo BuildReadOnlyValueReloadSafety()
    {
        return new ApiReloadSafetyInfo
        {
            Level = "safe"
        };
    }

    private static Assembly[] RelevantAssemblies()
    {
        return AppDomain.CurrentDomain
            .GetAssemblies()
            .Where(ShouldScanAssembly)
            .OrderBy(
                assembly =>
                    assembly.GetName().Name,
                StringComparer.Ordinal)
            .ToArray();
    }

    private static bool ShouldScanAssembly(
        Assembly assembly)
    {
        if (assembly.IsDynamic)
        {
            return false;
        }

        try
        {
            if (AssemblyLoadContext
                    .GetLoadContext(assembly)
                    ?.IsCollectible == true)
            {
                return false;
            }
        }
        catch
        {
            return false;
        }

        string name =
            assembly.GetName().Name ??
            "";

        if (
            name.Equals(
                "FrooxEngine",
                StringComparison.Ordinal) ||
            name.StartsWith(
                "FrooxEngine.",
                StringComparison.Ordinal) ||
            name.Equals(
                "ResoniteModLoader",
                StringComparison.Ordinal) ||
            name.StartsWith(
                "Elements.",
                StringComparison.Ordinal) ||
            name.StartsWith(
                "Renderite.",
                StringComparison.Ordinal) ||
            name.StartsWith(
                "CloudX.",
                StringComparison.Ordinal) ||
            name.StartsWith(
                "SkyFrost.",
                StringComparison.Ordinal) ||
            IsHarmonyAssemblyName(name)
        )
        {
            return true;
        }

        try
        {
            return assembly
                .GetReferencedAssemblies()
                .Any(reference =>
                    string.Equals(
                        reference.Name,
                        "FrooxEngine",
                        StringComparison.Ordinal) ||
                    string.Equals(
                        reference.Name,
                        "ResoniteModLoader",
                        StringComparison.Ordinal) ||
                    reference.Name?.StartsWith(
                        "Elements.",
                        StringComparison.Ordinal) == true ||
                    reference.Name?.StartsWith(
                        "Renderite.",
                        StringComparison.Ordinal) == true);
        }
        catch
        {
            return false;
        }
    }

    private static int CatalogAssemblyPriority(
        Assembly assembly)
    {
        string name =
            assembly.GetName().Name ??
            "";

        if (name.Equals(
                "FrooxEngine",
                StringComparison.Ordinal) ||
            name.StartsWith(
                "FrooxEngine.",
                StringComparison.Ordinal))
        {
            return 0;
        }

        if (name.StartsWith(
                "Elements.",
                StringComparison.Ordinal))
        {
            return 1;
        }

        if (name.StartsWith(
                "Renderite.",
                StringComparison.Ordinal))
        {
            return 2;
        }

        if (name.StartsWith(
                "CloudX.",
                StringComparison.Ordinal) ||
            name.StartsWith(
                "SkyFrost.",
                StringComparison.Ordinal))
        {
            return 3;
        }

        if (name.Equals(
                "ResoniteModLoader",
                StringComparison.Ordinal))
        {
            return 4;
        }

        return 5;
    }

    private static bool IsHarmonyAssemblyName(
        string? assemblyName)
    {
        return string.Equals(
                assemblyName,
                "0Harmony",
                StringComparison.Ordinal) ||
            string.Equals(
                assemblyName,
                "HarmonyLib",
                StringComparison.Ordinal) ||
            assemblyName?.StartsWith(
                "HarmonyLib.",
                StringComparison.Ordinal) == true;
    }

    private static Type? FindLoadedType(
        string fullName)
    {
        foreach (Assembly assembly in RelevantAssemblies())
        {
            try
            {
                Type? type =
                    assembly.GetType(
                        fullName,
                        throwOnError: false,
                        ignoreCase: false);

                if (type is not null)
                {
                    return type;
                }
            }
            catch
            {
            }
        }

        return null;
    }

    private static bool ImplementsAssetProviderFor(
        Type type,
        string assetTypeFullName)
    {
        foreach (Type interfaceType in SafeGetInterfaces(type))
        {
            if (!interfaceType.IsGenericType)
            {
                continue;
            }

            Type genericDefinition =
                interfaceType
                    .GetGenericTypeDefinition();

            if (!string.Equals(
                    genericDefinition.FullName,
                    "FrooxEngine.IAssetProvider`1",
                    StringComparison.Ordinal))
            {
                continue;
            }

            Type argument =
                interfaceType
                    .GetGenericArguments()[0];

            if (string.Equals(
                    argument.FullName,
                    assetTypeFullName,
                    StringComparison.Ordinal))
            {
                return true;
            }
        }

        return false;
    }

    private static bool ImplementsInterface(
        Type type,
        string interfaceFullName)
    {
        return SafeGetInterfaces(type)
            .Any(
                interfaceType =>
                    string.Equals(
                        interfaceType.FullName,
                        interfaceFullName,
                        StringComparison.Ordinal));
    }

    private static void AddCategory(
        ICollection<string> categories,
        bool condition,
        string category)
    {
        if (condition)
        {
            categories.Add(category);
        }
    }

    private static bool IsCatalogRelevantType(
        Type type,
        Type? componentBase,
        Type? workerBase)
    {
        if (!IsPublicType(type) ||
            type.Name.Contains('<') ||
            HasAttribute(
                type,
                typeof(CompilerGeneratedAttribute)
                    .FullName!))
        {
            return false;
        }

        return true;
    }

    private static bool IsPublicType(
        Type type)
    {
        if (type.IsPublic)
        {
            return true;
        }

        return
            type.IsNestedPublic &&
            type.DeclaringType is not null &&
            IsPublicType(
                type.DeclaringType);
    }

    private static string TypeKind(
        Type type)
    {
        if (type.IsEnum)
        {
            return "enum";
        }

        if (type.IsInterface)
        {
            return "interface";
        }

        if (type.IsValueType)
        {
            return "struct";
        }

        if (type.IsAbstract &&
            type.IsSealed)
        {
            return "static-class";
        }

        return "class";
    }

    private static IEnumerable<Type> GetLoadableTypes(
        Assembly assembly)
    {
        try
        {
            return assembly.GetTypes();
        }
        catch (ReflectionTypeLoadException exception)
        {
            return exception.Types
                .Where(type => type is not null)
                .Cast<Type>();
        }
        catch
        {
            return Array.Empty<Type>();
        }
    }

    private static Type[] SafeGetInterfaces(
        Type type)
    {
        try
        {
            return type.GetInterfaces();
        }
        catch
        {
            return Array.Empty<Type>();
        }
    }

    private static MethodInfo[] SafeGetMethods(
        Type type,
        BindingFlags flags)
    {
        try
        {
            return type.GetMethods(flags);
        }
        catch
        {
            return Array.Empty<MethodInfo>();
        }
    }

    private static ConstructorInfo[] SafeGetConstructors(
        Type type,
        BindingFlags flags)
    {
        try
        {
            return type.GetConstructors(flags);
        }
        catch
        {
            return Array.Empty<ConstructorInfo>();
        }
    }

    private static PropertyInfo[] SafeGetProperties(
        Type type,
        BindingFlags flags)
    {
        try
        {
            return type.GetProperties(flags);
        }
        catch
        {
            return Array.Empty<PropertyInfo>();
        }
    }

    private static FieldInfo[] SafeGetFields(
        Type type,
        BindingFlags flags)
    {
        try
        {
            return type.GetFields(flags);
        }
        catch
        {
            return Array.Empty<FieldInfo>();
        }
    }

    private static EventInfo[] SafeGetEvents(
        Type type,
        BindingFlags flags)
    {
        try
        {
            return type.GetEvents(flags);
        }
        catch
        {
            return Array.Empty<EventInfo>();
        }
    }

    private static bool IsExtensionMethod(
        MethodInfo method)
    {
        return method.IsDefined(
            typeof(ExtensionAttribute),
            inherit: false);
    }

    private static string MethodIdentity(
        MethodInfo method)
    {
        return
            (method.DeclaringType is null
                ? "unknown"
                : ContractTypeIdentity(
                    method.DeclaringType)) +
            "::" +
            (method.IsStatic
                ? "static::"
                : "instance::") +
            method.Name +
            "`" +
            method.GetGenericArguments()
                .Length.ToString(
                    CultureInfo.InvariantCulture) +
            "::" +
            ContractTypeIdentity(
                method.ReturnType) +
            "(" +
            string.Join(
                ",",
                method.GetParameters()
                    .OrderBy(
                        parameter =>
                            parameter.Position)
                    .Select(parameter =>
                        (parameter.IsOut
                            ? "out:"
                            : parameter.ParameterType.IsByRef &&
                              parameter.IsIn
                                ? "in:"
                                : parameter.ParameterType.IsByRef
                                    ? "ref:"
                                    : "value:") +
                        ContractTypeIdentity(
                            StripByRef(
                                parameter.ParameterType)))) +
            ")";
    }

    private static string ContractTypeIdentity(
        Type type)
    {
        if (type.IsByRef)
        {
            return ContractTypeIdentity(
                       type.GetElementType() ??
                       typeof(object)) +
                   "&";
        }

        if (type.IsPointer)
        {
            return ContractTypeIdentity(
                       type.GetElementType() ??
                       typeof(void)) +
                   "*";
        }

        if (type.IsArray)
        {
            return ContractTypeIdentity(
                       type.GetElementType() ??
                       typeof(object)) +
                   "[" +
                   new string(
                       ',',
                       Math.Max(
                           0,
                           type.GetArrayRank() - 1)) +
                   "]";
        }

        if (type.IsGenericParameter)
        {
            return
                (type.DeclaringMethod is null
                    ? "!"
                    : "!!") +
                type.GenericParameterPosition
                    .ToString(
                        CultureInfo.InvariantCulture);
        }

        if (type.IsGenericType)
        {
            Type definition =
                type.IsGenericTypeDefinition
                    ? type
                    : type.GetGenericTypeDefinition();
            return
                (definition.FullName ??
                 definition.Name) +
                "<" +
                string.Join(
                    ",",
                    type.GetGenericArguments()
                        .Select(
                            ContractTypeIdentity)) +
                ">";
        }

        return
            type.FullName ??
            type.Name;
    }

    private static string MethodSignature(
        MethodInfo method)
    {
        string generic =
            method.IsGenericMethodDefinition
                ? "<" +
                  string.Join(
                      ", ",
                      method.GetGenericArguments()
                          .Select(argument =>
                              argument.Name)) +
                  ">"
                : "";

        return
            CSharpTypeName(
                method.ReturnType) +
            " " +
            method.Name +
            generic +
            "(" +
            string.Join(
                ", ",
                method.GetParameters()
                    .Select(ParameterSignature)) +
            ")";
    }

    private static string ConstructorSignature(
        ConstructorInfo constructor)
    {
        return
            (constructor.DeclaringType?.Name ??
             ".ctor") +
            "(" +
            string.Join(
                ", ",
                constructor.GetParameters()
                    .Select(ParameterSignature)) +
            ")";
    }

    private static string ParameterSignature(
        ParameterInfo parameter)
    {
        string modifier =
            parameter.IsOut
                ? "out "
                : parameter.ParameterType.IsByRef &&
                  parameter.IsIn
                    ? "in "
                    : parameter.ParameterType.IsByRef
                        ? "ref "
                        : "";

        string optional =
            parameter.HasDefaultValue
                ? " = " +
                  ParameterDefaultCSharp(
                      parameter)
                : "";

        return
            modifier +
            CSharpTypeName(
                StripByRef(
                    parameter.ParameterType)) +
            " " +
            (parameter.Name ??
             $"arg{parameter.Position}") +
            optional;
    }

    private static Type StripByRef(
        Type type)
    {
        return type.IsByRef
            ? type.GetElementType() ??
              typeof(object)
            : type;
    }

    private static string CSharpTypeName(
        Type type)
    {
        if (type.IsByRef)
        {
            return CSharpTypeName(
                       type.GetElementType() ??
                       typeof(object)) +
                   "&";
        }

        if (type.IsPointer)
        {
            return CSharpTypeName(
                       type.GetElementType() ??
                       typeof(void)) +
                   "*";
        }

        if (type.IsArray)
        {
            return CSharpTypeName(
                       type.GetElementType() ??
                       typeof(object)) +
                   "[" +
                   new string(
                       ',',
                       Math.Max(
                           0,
                           type.GetArrayRank() - 1)) +
                   "]";
        }

        if (type.IsGenericParameter)
        {
            return EscapeCSharpIdentifier(
                type.Name);
        }

        List<Type> nesting =
            new();
        Type? current = type;

        while (current is not null)
        {
            nesting.Add(current);
            current = current.DeclaringType;
        }

        nesting.Reverse();

        Type[] allArguments =
            type.IsGenericType
                ? type.GetGenericArguments()
                : Array.Empty<Type>();
        int argumentIndex = 0;
        StringBuilder name =
            new();

        if (!string.IsNullOrWhiteSpace(
                nesting[0].Namespace))
        {
            name.Append(
                string.Join(
                    ".",
                    nesting[0]
                        .Namespace!
                        .Split('.')
                        .Select(
                            EscapeCSharpIdentifier)));
            name.Append('.');
        }

        for (int index = 0;
             index < nesting.Count;
             index++)
        {
            if (index > 0)
            {
                name.Append('.');
            }

            Type segment =
                nesting[index];
            string rawName =
                segment.Name;
            int tick =
                rawName.IndexOf('`');
            int ownArity = 0;

            if (tick >= 0)
            {
                int.TryParse(
                    rawName[(tick + 1)..],
                    NumberStyles.Integer,
                    CultureInfo.InvariantCulture,
                    out ownArity);
                rawName = rawName[..tick];
            }

            name.Append(
                EscapeCSharpIdentifier(
                    rawName));

            if (ownArity <= 0)
            {
                continue;
            }

            Type[] arguments =
                allArguments
                    .Skip(argumentIndex)
                    .Take(ownArity)
                    .ToArray();
            argumentIndex +=
                arguments.Length;

            if (arguments.Length > 0)
            {
                name.Append('<');
                name.Append(
                    string.Join(
                        ", ",
                        arguments.Select(
                            CSharpTypeName)));
                name.Append('>');
            }
        }

        return name.ToString();
    }

    private static string ParameterDefaultCSharp(
        ParameterInfo parameter)
    {
        Type type =
            StripByRef(
                parameter.ParameterType);
        object? value =
            SafeDefaultValue(
                parameter);

        if (
            value is null &&
            type.IsValueType &&
            Nullable.GetUnderlyingType(type) is null
        )
        {
            return "default(" +
                   CSharpTypeName(type) +
                   ")";
        }

        return CSharpLiteral(
            value,
            type);
    }

    private static object? SafeDefaultValue(
        ParameterInfo parameter)
    {
        try
        {
            object? value =
                parameter.DefaultValue;

            return value is DBNull ||
                   value == Type.Missing
                ? null
                : value;
        }
        catch
        {
            return null;
        }
    }

    private static string CSharpLiteral(
        object? value,
        Type type)
    {
        if (value is null)
        {
            return "null";
        }

        Type actualType =
            Nullable.GetUnderlyingType(type) ??
            type;

        if (actualType.IsEnum)
        {
            string? name =
                Enum.GetName(
                    actualType,
                    value);

            return name is not null
                ? CSharpTypeName(actualType) +
                  "." +
                  EscapeCSharpIdentifier(name)
                : "(" +
                  CSharpTypeName(actualType) +
                  ")" +
                  Convert.ToString(
                      value,
                      CultureInfo.InvariantCulture);
        }

        if (actualType == typeof(float))
        {
            float single =
                Convert.ToSingle(
                    value,
                    CultureInfo.InvariantCulture);

            if (float.IsNaN(single))
            {
                return "float.NaN";
            }

            if (float.IsPositiveInfinity(single))
            {
                return "float.PositiveInfinity";
            }

            if (float.IsNegativeInfinity(single))
            {
                return "float.NegativeInfinity";
            }

            return single.ToString(
                       "R",
                       CultureInfo.InvariantCulture) +
                   "f";
        }

        if (actualType == typeof(double))
        {
            double number =
                Convert.ToDouble(
                    value,
                    CultureInfo.InvariantCulture);

            if (double.IsNaN(number))
            {
                return "double.NaN";
            }

            if (double.IsPositiveInfinity(number))
            {
                return "double.PositiveInfinity";
            }

            if (double.IsNegativeInfinity(number))
            {
                return "double.NegativeInfinity";
            }

            return number.ToString(
                       "R",
                       CultureInfo.InvariantCulture) +
                   "d";
        }

        if (actualType == typeof(decimal))
        {
            return Convert.ToDecimal(
                       value,
                       CultureInfo.InvariantCulture)
                       .ToString(
                           CultureInfo.InvariantCulture) +
                   "m";
        }

        if (actualType == typeof(uint))
        {
            return Convert.ToUInt32(
                       value,
                       CultureInfo.InvariantCulture)
                       .ToString(
                           CultureInfo.InvariantCulture) +
                   "u";
        }

        if (actualType == typeof(long))
        {
            return Convert.ToInt64(
                       value,
                       CultureInfo.InvariantCulture)
                       .ToString(
                           CultureInfo.InvariantCulture) +
                   "L";
        }

        if (actualType == typeof(ulong))
        {
            return Convert.ToUInt64(
                       value,
                       CultureInfo.InvariantCulture)
                       .ToString(
                           CultureInfo.InvariantCulture) +
                   "UL";
        }

        if (actualType == typeof(string))
        {
            return "\"" +
                   EscapeCSharpString(
                       Convert.ToString(
                           value,
                           CultureInfo.InvariantCulture) ??
                       string.Empty) +
                   "\"";
        }

        if (actualType == typeof(char))
        {
            return "'" +
                   EscapeCSharpCharacter(
                       Convert.ToChar(
                           value,
                           CultureInfo.InvariantCulture)) +
                   "'";
        }

        if (actualType == typeof(bool))
        {
            return Convert.ToBoolean(
                    value,
                    CultureInfo.InvariantCulture)
                ? "true"
                : "false";
        }

        if (actualType == typeof(DateTime))
        {
            DateTime dateTime =
                (DateTime)value;

            return "new System.DateTime(" +
                   dateTime.Ticks.ToString(
                       CultureInfo.InvariantCulture) +
                   "L, System.DateTimeKind." +
                   dateTime.Kind +
                   ")";
        }

        if (actualType == typeof(TimeSpan))
        {
            TimeSpan timeSpan =
                (TimeSpan)value;

            return "new System.TimeSpan(" +
                   timeSpan.Ticks.ToString(
                       CultureInfo.InvariantCulture) +
                   "L)";
        }

        if (actualType == typeof(Guid))
        {
            return "new System.Guid(\"" +
                   ((Guid)value).ToString("D") +
                   "\")";
        }

        return Convert.ToString(
                   value,
                   CultureInfo.InvariantCulture) ??
               "null";
    }

    private static readonly HashSet<string> CSharpKeywords =
        new(
            new[]
            {
                "abstract", "as", "base", "bool", "break", "byte",
                "case", "catch", "char", "checked", "class", "const",
                "continue", "decimal", "default", "delegate", "do",
                "double", "else", "enum", "event", "explicit", "extern",
                "false", "finally", "fixed", "float", "for", "foreach",
                "goto", "if", "implicit", "in", "int", "interface",
                "internal", "is", "lock", "long", "namespace", "new",
                "null", "object", "operator", "out", "override", "params",
                "private", "protected", "public", "readonly", "ref",
                "return", "sbyte", "sealed", "short", "sizeof", "stackalloc",
                "static", "string", "struct", "switch", "this", "throw",
                "true", "try", "typeof", "uint", "ulong", "unchecked",
                "unsafe", "ushort", "using", "virtual", "void", "volatile",
                "while", "add", "alias", "and", "ascending", "async",
                "await", "by", "descending", "dynamic", "equals", "file",
                "from", "get", "global", "group", "init", "into", "join",
                "let", "managed", "nameof", "nint", "not", "notnull",
                "nuint", "on", "or", "orderby", "partial", "record",
                "remove", "required", "scoped", "select", "set", "unmanaged",
                "value", "var", "when", "where", "with", "yield"
            },
            StringComparer.Ordinal);

    private static string EscapeCSharpIdentifier(
        string value)
    {
        if (string.IsNullOrEmpty(value))
        {
            return "_";
        }

        return CSharpKeywords.Contains(value)
            ? "@" + value
            : value;
    }

    private static string EscapeCSharpString(
        string value)
    {
        StringBuilder escaped =
            new(value.Length + 8);

        foreach (char character in value)
        {
            escaped.Append(
                EscapeCSharpCharacter(
                    character,
                    forString: true));
        }

        return escaped.ToString();
    }

    private static string EscapeCSharpCharacter(
        char value,
        bool forString = false)
    {
        return value switch
        {
            '\\' => "\\\\",
            '\"' when forString => "\\\"",
            '\'' when !forString => "\\'",
            '\0' => "\\0",
            '\a' => "\\a",
            '\b' => "\\b",
            '\f' => "\\f",
            '\n' => "\\n",
            '\r' => "\\r",
            '\t' => "\\t",
            '\v' => "\\v",
            _ when char.IsControl(value) =>
                "\\u" +
                ((int)value).ToString(
                    "x4",
                    CultureInfo.InvariantCulture),
            _ => value.ToString()
        };
    }

    private static List<string> AttributeNames(
        MemberInfo member)
    {
        try
        {
            return CustomAttributeData
                .GetCustomAttributes(member)
                .Select(
                    attribute =>
                        attribute.AttributeType
                            .FullName ??
                        attribute.AttributeType.Name)
                .Distinct(
                    StringComparer.Ordinal)
                .OrderBy(
                    value => value,
                    StringComparer.Ordinal)
                .ToList();
        }
        catch
        {
            return new();
        }
    }

    private static List<string> AttributeNames(
        ParameterInfo parameter)
    {
        try
        {
            return CustomAttributeData
                .GetCustomAttributes(parameter)
                .Select(
                    attribute =>
                        attribute.AttributeType
                            .FullName ??
                        attribute.AttributeType.Name)
                .Distinct(
                    StringComparer.Ordinal)
                .OrderBy(
                    value => value,
                    StringComparer.Ordinal)
                .ToList();
        }
        catch
        {
            return new();
        }
    }

    private static bool HasAttribute(
        MemberInfo member,
        string attributeFullName)
    {
        return AttributeNames(member)
            .Contains(
                attributeFullName,
                StringComparer.Ordinal);
    }

    private static string ComputeAssemblyFingerprint(
        IEnumerable<ApiAssemblyInfo> assemblies)
    {
        string source =
            string.Join(
                "|",
                assemblies.Select(
                    assembly =>
                        assembly.Name +
                        "@" +
                        assembly.Version +
                        "#" +
                        string.Join(
                            ",",
                            assembly.ModuleVersionIds)));

        return ComputeSha256(source);
    }

    private static string ComputeCatalogFingerprint(
        ApiCatalog catalog)
    {
        JsonElement root =
            JsonSerializer.SerializeToElement(
                catalog,
                JsonOptions);

        return ComputeCatalogFingerprint(
            root);
    }

    private static string ComputeCatalogFingerprint(
        JsonElement root)
    {

        using MemoryStream buffer =
            new();

        using (
            Utf8JsonWriter writer =
                new(
                    buffer,
                    new JsonWriterOptions
                    {
                        Indented = false,
                        SkipValidation = false
                    }))
        {
            WriteCanonicalCatalogJson(
                writer,
                root,
                isRoot: true);
            writer.Flush();
        }

        return ComputeSha256(
            buffer.ToArray());
    }

    private static void WriteCanonicalCatalogJson(
        Utf8JsonWriter writer,
        JsonElement element,
        bool isRoot = false)
    {
        switch (element.ValueKind)
        {
            case JsonValueKind.Object:
                writer.WriteStartObject();

                foreach (
                    JsonProperty property in
                    element
                        .EnumerateObject()
                        .Where(property =>
                            !isRoot ||
                            !IsVolatileCatalogProperty(
                                property.Name))
                        .OrderBy(
                            property =>
                                property.Name,
                            StringComparer.Ordinal))
                {
                    writer.WritePropertyName(
                        property.Name);
                    WriteCanonicalCatalogJson(
                        writer,
                        property.Value);
                }

                writer.WriteEndObject();
                break;

            case JsonValueKind.Array:
                writer.WriteStartArray();

                foreach (
                    JsonElement item in
                    element.EnumerateArray())
                {
                    WriteCanonicalCatalogJson(
                        writer,
                        item);
                }

                writer.WriteEndArray();
                break;

            default:
                element.WriteTo(writer);
                break;
        }
    }

    private static bool IsVolatileCatalogProperty(
        string propertyName)
    {
        return
            propertyName.Equals(
                "catalogFingerprint",
                StringComparison.Ordinal) ||
            propertyName.Equals(
                "generatedAtUtc",
                StringComparison.Ordinal) ||
            propertyName.Equals(
                "endpoint",
                StringComparison.Ordinal);
    }

    private static string ComputeSha256(
        string value)
    {
        return ComputeSha256(
            Encoding.UTF8.GetBytes(
                value));
    }

    private static string ComputeSha256(
        byte[] value)
    {
        byte[] hash =
            SHA256.HashData(value);

        return Convert.ToHexString(hash)
            .ToLowerInvariant();
    }

    private static async Task WriteAtomicallyAsync(
        string destination,
        string content)
    {
        string temporary =
            destination +
            ".tmp";

        await File.WriteAllTextAsync(
            temporary,
            content,
            new UTF8Encoding(
                encoderShouldEmitUTF8Identifier: false));

        File.Move(
            temporary,
            destination,
            overwrite: true);
    }

    private static void LoadCachedCatalog()
    {
        try
        {
            string runtimeAssemblyFingerprint =
                ComputeAssemblyFingerprint(
                    RelevantAssemblies()
                        .Select(BuildAssemblyInfo));

            if (!File.Exists(CatalogPath))
            {
                lock (StateLock)
                {
                    _runtimeAssemblyFingerprint =
                        runtimeAssemblyFingerprint;
                }
                return;
            }

            string json =
                File.ReadAllText(
                    CatalogPath,
                    Encoding.UTF8);

            using JsonDocument document =
                JsonDocument.Parse(json);

            string catalogFingerprint =
                document.RootElement
                    .TryGetProperty(
                        "catalogFingerprint",
                        out JsonElement catalogValue)
                    ? catalogValue.GetString() ??
                      ""
                    : "";
            string assemblyFingerprint =
                document.RootElement
                    .TryGetProperty(
                        "assemblyFingerprint",
                        out JsonElement assemblyValue)
                    ? assemblyValue.GetString() ??
                      ""
                    : "";
            int schemaVersion =
                document.RootElement
                    .TryGetProperty(
                        "schemaVersion",
                        out JsonElement schemaValue) &&
                schemaValue.TryGetInt32(
                    out int parsedSchema)
                    ? parsedSchema
                    : 0;
            string scannerVersion =
                document.RootElement
                    .TryGetProperty(
                        "scannerVersion",
                        out JsonElement scannerValue)
                    ? scannerValue.GetString() ??
                      ""
                    : "";
            int fingerprintVersion =
                document.RootElement
                    .TryGetProperty(
                        "catalogFingerprintVersion",
                        out JsonElement fingerprintVersionValue) &&
                fingerprintVersionValue.TryGetInt32(
                    out int parsedFingerprintVersion)
                    ? parsedFingerprintVersion
                    : 0;
            string fingerprintAlgorithm =
                document.RootElement
                    .TryGetProperty(
                        "catalogFingerprintAlgorithm",
                        out JsonElement fingerprintAlgorithmValue)
                    ? fingerprintAlgorithmValue.GetString() ??
                      ""
                    : "";
            int methodIdentityVersion =
                document.RootElement
                    .TryGetProperty(
                        "methodIdentityVersion",
                        out JsonElement methodIdentityVersionValue) &&
                methodIdentityVersionValue.TryGetInt32(
                    out int parsedMethodIdentityVersion)
                    ? parsedMethodIdentityVersion
                    : 0;
            string methodIdentityAlgorithm =
                document.RootElement
                    .TryGetProperty(
                        "methodIdentityAlgorithm",
                        out JsonElement methodIdentityAlgorithmValue)
                    ? methodIdentityAlgorithmValue.GetString() ??
                      ""
                    : "";
            int reloadSafetyVersion =
                document.RootElement
                    .TryGetProperty(
                        "reloadSafetyContractVersion",
                        out JsonElement reloadSafetyVersionValue) &&
                reloadSafetyVersionValue.TryGetInt32(
                    out int parsedReloadSafetyVersion)
                    ? parsedReloadSafetyVersion
                    : 0;
            string reloadSafetyPolicy =
                document.RootElement
                    .TryGetProperty(
                        "reloadSafetyPolicy",
                        out JsonElement reloadSafetyPolicyValue)
                    ? reloadSafetyPolicyValue.GetString() ??
                      ""
                    : "";
            int reloadSafetyMinimumReaderVersion =
                document.RootElement
                    .TryGetProperty(
                        "reloadSafetyMinimumReaderVersion",
                        out JsonElement reloadSafetyMinimumReaderValue) &&
                reloadSafetyMinimumReaderValue.TryGetInt32(
                    out int parsedReloadSafetyMinimumReaderVersion)
                    ? parsedReloadSafetyMinimumReaderVersion
                    : 0;
            int reloadSafetyMaximumReaderVersion =
                document.RootElement
                    .TryGetProperty(
                        "reloadSafetyMaximumReaderVersion",
                        out JsonElement reloadSafetyMaximumReaderValue) &&
                reloadSafetyMaximumReaderValue.TryGetInt32(
                    out int parsedReloadSafetyMaximumReaderVersion)
                    ? parsedReloadSafetyMaximumReaderVersion
                    : 0;
            int suppressedDuplicateTypeDefinitions =
                document.RootElement
                    .TryGetProperty(
                        "suppressedDuplicateTypeDefinitions",
                        out JsonElement suppressedDuplicateTypeDefinitionsValue) &&
                suppressedDuplicateTypeDefinitionsValue.TryGetInt32(
                    out int parsedSuppressedDuplicateTypeDefinitions)
                    ? parsedSuppressedDuplicateTypeDefinitions
                    : 0;
            bool compatible =
                schemaVersion ==
                    CatalogSchemaVersion &&
                string.Equals(
                    scannerVersion,
                    ScannerVersion,
                    StringComparison.Ordinal) &&
                fingerprintVersion ==
                    FingerprintContractVersion &&
                string.Equals(
                    fingerprintAlgorithm,
                    FingerprintAlgorithm,
                    StringComparison.Ordinal) &&
                methodIdentityVersion ==
                    MethodIdentityVersion &&
                string.Equals(
                    methodIdentityAlgorithm,
                    MethodIdentityAlgorithm,
                    StringComparison.Ordinal) &&
                reloadSafetyVersion ==
                    ReloadSafetyContractVersion &&
                string.Equals(
                    reloadSafetyPolicy,
                    ReloadSafetyPolicy,
                    StringComparison.Ordinal) &&
                reloadSafetyMinimumReaderVersion <=
                    ReloadSafetyContractVersion &&
                reloadSafetyMaximumReaderVersion >=
                    ReloadSafetyContractVersion &&
                !string.IsNullOrWhiteSpace(
                    assemblyFingerprint) &&
                string.Equals(
                    assemblyFingerprint,
                    runtimeAssemblyFingerprint,
                    StringComparison.Ordinal) &&
                !string.IsNullOrWhiteSpace(
                    catalogFingerprint) &&
                string.Equals(
                    catalogFingerprint,
                    ComputeCatalogFingerprint(
                        document.RootElement),
                    StringComparison.Ordinal);

            lock (StateLock)
            {
                _runtimeAssemblyFingerprint =
                    runtimeAssemblyFingerprint;
                _catalogJson =
                    compatible
                        ? json
                        : "{}";
                _assemblyFingerprint =
                    compatible
                        ? assemblyFingerprint
                        : "";
                _catalogFingerprint =
                    compatible
                        ? catalogFingerprint
                        : "";
                _suppressedDuplicateTypeDefinitions =
                    compatible
                        ? suppressedDuplicateTypeDefinitions
                        : 0;
            }

            Msg(
                compatible
                    ? $"[API Catalog] Loaded compatible cached catalog; scanner={ScannerVersion}; assemblies={runtimeAssemblyFingerprint}."
                    : $"[API Catalog] Cache invalidated; scanner cached={scannerVersion}, active={ScannerVersion}; assemblies cached={assemblyFingerprint}, active={runtimeAssemblyFingerprint}. A full scan is required.");
        }
        catch (Exception exception)
        {
            Msg(
                "[API Catalog] Cached catalog could not be read: " +
                exception.Message);
        }
    }


    public static void PublishRuntimeDisplay(
        string channel,
        string sessionId,
        string monitorId,
        string label,
        string graphType,
        object? value)
    {
        try
        {
            PublishRuntimeDisplayCore(
                channel,
                sessionId,
                monitorId,
                label,
                graphType,
                value);
        }
        catch (Exception exception)
        {
            long now =
                Environment.TickCount64;
            long next =
                Interlocked.Read(
                    ref _runtimePublishFailureLogAfter);

            if (now >= next)
            {
                Interlocked.Exchange(
                    ref _runtimePublishFailureLogAfter,
                    now + 10000);

                Msg(
                    "[Runtime Bridge] A runtime value could not be published: " +
                    exception.Message);
            }
        }
    }

    private static void PublishRuntimeDisplayCore(
        string channel,
        string sessionId,
        string monitorId,
        string label,
        string graphType,
        object? value)
    {
        string normalizedChannel =
            NormalizeRuntimeText(
                channel,
                240);
        string normalizedMonitorId =
            NormalizeRuntimeText(
                monitorId,
                240);

        if (
            string.IsNullOrWhiteSpace(
                normalizedChannel) ||
            string.IsNullOrWhiteSpace(
                normalizedMonitorId)
        )
        {
            return;
        }

        string normalizedSession =
            NormalizeRuntimeText(
                sessionId,
                160);

        if (string.IsNullOrWhiteSpace(
                normalizedSession))
        {
            normalizedSession =
                "default";
        }

        string normalizedLabel =
            NormalizeRuntimeText(
                label,
                240);

        if (string.IsNullOrWhiteSpace(
                normalizedLabel))
        {
            normalizedLabel =
                normalizedMonitorId;
        }

        string normalizedGraphType =
            NormalizeRuntimeText(
                graphType,
                240);

        RuntimeValueDescription description =
            DescribeRuntimeValue(
                value);
        DateTimeOffset now =
            DateTimeOffset.UtcNow;
        RuntimeSseMessage? message =
            null;

        lock (RuntimeLock)
        {
            PruneRuntimeChannelsLocked(
                now);

            RuntimeChannels.TryGetValue(
                normalizedChannel,
                out RuntimeChannelState? state);

            bool sessionChanged =
                state is null ||
                !string.Equals(
                    state.SessionId,
                    normalizedSession,
                    StringComparison.Ordinal);
            long incomingSessionStarted =
                RuntimeSessionStartedAt(
                    normalizedSession);

            if (
                sessionChanged &&
                state is not null &&
                incomingSessionStarted > 0 &&
                state.SessionStartedAtUnixMilliseconds > 0 &&
                incomingSessionStarted <
                    state.SessionStartedAtUnixMilliseconds
            )
            {
                return;
            }

            if (sessionChanged)
            {
                state =
                    new RuntimeChannelState
                    {
                        Channel =
                            normalizedChannel,
                        SessionId =
                            normalizedSession,
                        SessionStartedAtUnixMilliseconds =
                            incomingSessionStarted,
                        StartedAtUtc =
                            now,
                        LastSeenUtc =
                            now
                    };

                RuntimeChannels[
                    normalizedChannel
                ] = state;
            }

            state!.LastSeenUtc =
                now;

            state.Values.TryGetValue(
                normalizedMonitorId,
                out RuntimeDisplayRecord? previous);

            string fingerprint =
                string.Join(
                    "\u001f",
                    normalizedLabel,
                    normalizedGraphType,
                    description.RuntimeType,
                    description.ValueKind,
                    description.Display,
                    description.ValueFingerprint);

            bool changed =
                sessionChanged ||
                previous is null ||
                !string.Equals(
                    previous.Fingerprint,
                    fingerprint,
                    StringComparison.Ordinal);

            bool heartbeatDue =
                previous is null ||
                now -
                    previous.LastBroadcastAtUtc >=
                RuntimeUnchangedBroadcastInterval;

            long sequence =
                previous?.Sequence ??
                Volatile.Read(
                    ref _runtimeSequence);

            if (changed || heartbeatDue)
            {
                sequence =
                    Interlocked.Increment(
                        ref _runtimeSequence);
            }

            RuntimeDisplayRecord record =
                new()
                {
                    MonitorId =
                        normalizedMonitorId,
                    Label =
                        normalizedLabel,
                    GraphType =
                        normalizedGraphType,
                    RuntimeType =
                        description.RuntimeType,
                    ValueKind =
                        description.ValueKind,
                    Display =
                        description.Display,
                    Value =
                        description.Value,
                    IsNull =
                        value is null,
                    Sequence =
                        sequence,
                    UpdatedAtUtc =
                        now,
                    LastBroadcastAtUtc =
                        changed || heartbeatDue
                            ? now
                            : previous?
                                .LastBroadcastAtUtc ??
                              DateTimeOffset.MinValue,
                    Fingerprint =
                        fingerprint
                };

            state.Values[
                normalizedMonitorId
            ] = record;

            TrimRuntimeChannelLocked(
                state);

            if (changed || heartbeatDue)
            {
                string json =
                    JsonSerializer.Serialize(
                        new
                        {
                            kind =
                                "display",
                            bridgeVersion =
                                RuntimeBridgeVersion,
                            channel =
                                normalizedChannel,
                            sessionId =
                                normalizedSession,
                            reset =
                                sessionChanged,
                            active =
                                true,
                            lastSeenUtc =
                                now,
                            value =
                                record
                        },
                        JsonOptions);

                message =
                    new RuntimeSseMessage(
                        sequence,
                        json);
            }
        }

        if (message is not null)
        {
            BroadcastRuntimeMessage(
                normalizedChannel,
                message);
        }
    }

    private static string NormalizeRuntimeText(
        string? value,
        int maximumLength)
    {
        string normalized =
            (value ?? string.Empty)
                .Trim();

        return normalized.Length <=
                maximumLength
            ? normalized
            : normalized[..maximumLength];
    }

    private static long RuntimeSessionStartedAt(
        string sessionId)
    {
        int separator =
            sessionId.IndexOf('-');
        string prefix =
            separator > 0
                ? sessionId[..separator]
                : sessionId;

        return long.TryParse(
            prefix,
            NumberStyles.Integer,
            CultureInfo.InvariantCulture,
            out long value)
            ? value
            : 0;
    }

    private static RuntimeValueDescription
        DescribeRuntimeValue(
            object? value,
            int depth = 0)
    {
        if (value is null)
        {
            return new RuntimeValueDescription
            {
                Display =
                    "<null>",
                RuntimeType =
                    "null",
                ValueKind =
                    "null",
                Value =
                    null,
                ValueFingerprint =
                    "null"
            };
        }

        Type runtimeType =
            value.GetType();
        string runtimeTypeName =
            runtimeType.FullName ??
            runtimeType.Name;

        if (value is string text)
        {
            string display =
                LimitRuntimeDisplay(
                    text);

            return RuntimeValue(
                display,
                runtimeTypeName,
                "string",
                display);
        }

        if (value is char character)
        {
            string display =
                character.ToString();

            return RuntimeValue(
                display,
                runtimeTypeName,
                "scalar",
                display);
        }

        if (value is bool boolean)
        {
            return RuntimeValue(
                boolean
                    ? "true"
                    : "false",
                runtimeTypeName,
                "scalar",
                boolean);
        }

        if (
            value is byte or
            sbyte or
            short or
            ushort or
            int or
            uint or
            long or
            ulong or
            float or
            double or
            decimal
        )
        {
            string display =
                value is IFormattable formattable
                    ? formattable.ToString(
                          null,
                          CultureInfo.InvariantCulture) ??
                      string.Empty
                    : value.ToString() ??
                      string.Empty;

            object jsonValue =
                value is double doubleValue &&
                    !double.IsFinite(
                        doubleValue)
                    ? display
                    : value is float floatValue &&
                        !float.IsFinite(
                            floatValue)
                        ? display
                        : value;

            return RuntimeValue(
                display,
                runtimeTypeName,
                "scalar",
                jsonValue);
        }

        if (value is Enum enumValue)
        {
            string display =
                enumValue.ToString();

            return RuntimeValue(
                display,
                runtimeTypeName,
                "enum",
                display);
        }

        if (value is Uri uri)
        {
            string display =
                uri.ToString();

            return RuntimeValue(
                display,
                runtimeTypeName,
                "uri",
                display);
        }

        if (value is DateTime dateTime)
        {
            string display =
                dateTime.ToString(
                    "O",
                    CultureInfo.InvariantCulture);

            return RuntimeValue(
                display,
                runtimeTypeName,
                "time",
                display);
        }

        if (
            value is
                DateTimeOffset dateTimeOffset)
        {
            string display =
                dateTimeOffset.ToString(
                    "O",
                    CultureInfo.InvariantCulture);

            return RuntimeValue(
                display,
                runtimeTypeName,
                "time",
                display);
        }

        if (value is TimeSpan timeSpan)
        {
            string display =
                timeSpan.ToString(
                    "c",
                    CultureInfo.InvariantCulture);

            return RuntimeValue(
                display,
                runtimeTypeName,
                "time",
                display);
        }

        if (value is Guid guid)
        {
            string display =
                guid.ToString("D");

            return RuntimeValue(
                display,
                runtimeTypeName,
                "guid",
                display);
        }

        if (value is Type reflectedType)
        {
            string display =
                reflectedType.FullName ??
                reflectedType.Name;

            return RuntimeValue(
                display,
                runtimeTypeName,
                "type",
                display);
        }

        if (value is MemberInfo member)
        {
            string display =
                string.IsNullOrWhiteSpace(
                    member.DeclaringType?
                        .FullName)
                    ? member.Name
                    : member.DeclaringType!
                          .FullName +
                      "." +
                      member.Name;

            return RuntimeValue(
                display,
                runtimeTypeName,
                "member",
                display);
        }

        if (value is Exception exception)
        {
            string display =
                LimitRuntimeDisplay(
                    $"{exception.GetType().Name}: {exception.Message}");

            return RuntimeValue(
                display,
                runtimeTypeName,
                "exception",
                new Dictionary<string, object?>
                {
                    ["type"] =
                        exception.GetType()
                            .FullName,
                    ["message"] =
                        exception.Message
                });
        }

        if (value is byte[] bytes)
        {
            string display =
                $"byte[{bytes.Length}]";
            object jsonValue =
                bytes.Length <= 1024
                    ? Convert.ToBase64String(
                        bytes)
                    : display;

            return RuntimeValue(
                display,
                runtimeTypeName,
                "binary",
                jsonValue);
        }

        if (
            depth < 2 &&
            value is IDictionary dictionary)
        {
            Dictionary<string, object?>
                values =
                    new(
                        StringComparer.Ordinal);
            int count =
                0;

            foreach (
                DictionaryEntry entry in
                dictionary)
            {
                if (count >= 24)
                {
                    values["…"] =
                        "truncated";
                    break;
                }

                string key =
                    Convert.ToString(
                        entry.Key,
                        CultureInfo.InvariantCulture) ??
                    "<null>";
                RuntimeValueDescription item =
                    DescribeRuntimeValue(
                        entry.Value,
                        depth + 1);
                values[
                    LimitRuntimeDisplay(
                        key,
                        120)
                ] = item.Value ??
                    item.Display;
                count++;
            }

            string display =
                $"{runtimeType.Name} ({dictionary.Count} entries)";

            return RuntimeValue(
                display,
                runtimeTypeName,
                "map",
                values);
        }

        if (
            depth < 2 &&
            value is IEnumerable sequence)
        {
            List<object?> values =
                new();
            int count =
                0;
            bool truncated =
                false;

            foreach (object? item in sequence)
            {
                if (count >= 24)
                {
                    truncated =
                        true;
                    break;
                }

                RuntimeValueDescription
                    description =
                        DescribeRuntimeValue(
                            item,
                            depth + 1);
                values.Add(
                    description.Value ??
                    description.Display);
                count++;
            }

            if (truncated)
            {
                values.Add("…");
            }

            string display =
                $"{runtimeType.Name} [{count}{(truncated ? "+" : "")}]";

            return RuntimeValue(
                display,
                runtimeTypeName,
                "sequence",
                values);
        }

        string? name =
            TryRuntimeMemberText(
                value,
                "Name");
        string? reference =
            TryRuntimeMemberText(
                value,
                "ReferenceID") ??
            TryRuntimeMemberText(
                value,
                "ReferenceId");

        if (string.IsNullOrWhiteSpace(name))
        {
            object? slot =
                TryRuntimeMemberValue(
                    value,
                    "Slot");

            if (slot is not null)
            {
                name =
                    TryRuntimeMemberText(
                        slot,
                        "Name");
                reference ??=
                    TryRuntimeMemberText(
                        slot,
                        "ReferenceID") ??
                    TryRuntimeMemberText(
                        slot,
                        "ReferenceId");
            }
        }

        string fallback =
            SafeRuntimeToString(
                value);

        string objectDisplay =
            !string.IsNullOrWhiteSpace(name)
                ? $"{runtimeType.Name} \"{name}\""
                : fallback;

        if (
            !string.IsNullOrWhiteSpace(
                reference) &&
            !objectDisplay.Contains(
                reference,
                StringComparison.Ordinal)
        )
        {
            objectDisplay +=
                $" [{reference}]";
        }

        objectDisplay =
            LimitRuntimeDisplay(
                objectDisplay);

        Dictionary<string, object?>
            summary =
                new(
                    StringComparer.Ordinal)
                {
                    ["display"] =
                        objectDisplay,
                    ["runtimeType"] =
                        runtimeTypeName
                };

        if (!string.IsNullOrWhiteSpace(name))
        {
            summary["name"] =
                name;
        }

        if (
            !string.IsNullOrWhiteSpace(
                reference)
        )
        {
            summary["referenceId"] =
                reference;
        }

        return RuntimeValue(
            objectDisplay,
            runtimeTypeName,
            "object",
            summary);
    }

    private static RuntimeValueDescription
        RuntimeValue(
            string display,
            string runtimeType,
            string valueKind,
            object? value)
    {
        string normalizedDisplay =
            LimitRuntimeDisplay(
                display);
        string fingerprint;

        try
        {
            fingerprint =
                JsonSerializer.Serialize(
                    value,
                    JsonOptions);
        }
        catch
        {
            fingerprint =
                normalizedDisplay;
        }

        return new RuntimeValueDescription
        {
            Display =
                normalizedDisplay,
            RuntimeType =
                runtimeType,
            ValueKind =
                valueKind,
            Value =
                value,
            ValueFingerprint =
                fingerprint
        };
    }

    private static string
        LimitRuntimeDisplay(
            string? value,
            int maximumLength = 2048)
    {
        string text =
            value ?? string.Empty;

        return text.Length <=
                maximumLength
            ? text
            : text[..maximumLength] +
              "…";
    }

    private static string SafeRuntimeToString(
        object value)
    {
        try
        {
            if (value is IFormattable formattable)
            {
                return LimitRuntimeDisplay(
                    formattable.ToString(
                        null,
                        CultureInfo.InvariantCulture));
            }

            return LimitRuntimeDisplay(
                value.ToString());
        }
        catch (Exception exception)
        {
            return
                $"<{value.GetType().Name}: {exception.GetType().Name}>";
        }
    }

    private static object?
        TryRuntimeMemberValue(
            object target,
            string memberName)
    {
        try
        {
            Type type =
                target.GetType();
            BindingFlags flags =
                BindingFlags.Instance |
                BindingFlags.Public |
                BindingFlags.NonPublic |
                BindingFlags.IgnoreCase;

            PropertyInfo? property =
                type.GetProperty(
                    memberName,
                    flags);

            if (
                property is not null &&
                property.GetIndexParameters()
                    .Length == 0
            )
            {
                return property.GetValue(
                    target);
            }

            FieldInfo? field =
                type.GetField(
                    memberName,
                    flags);

            return field?.GetValue(
                target);
        }
        catch
        {
            return null;
        }
    }

    private static string?
        TryRuntimeMemberText(
            object target,
            string memberName)
    {
        object? value =
            TryRuntimeMemberValue(
                target,
                memberName);

        if (value is null)
        {
            return null;
        }

        object? nested =
            TryRuntimeMemberValue(
                value,
                "Value");

        if (nested is not null)
        {
            value =
                nested;
        }

        try
        {
            return NormalizeRuntimeText(
                Convert.ToString(
                    value,
                    CultureInfo.InvariantCulture),
                512);
        }
        catch
        {
            return null;
        }
    }

    private static void
        TrimRuntimeChannelLocked(
            RuntimeChannelState state)
    {
        if (
            state.Values.Count <=
            RuntimeMaximumValuesPerChannel
        )
        {
            return;
        }

        foreach (
            string monitorId in
            state.Values
                .Values
                .OrderBy(
                    value =>
                        value.UpdatedAtUtc)
                .Take(
                    state.Values.Count -
                    RuntimeMaximumValuesPerChannel)
                .Select(
                    value =>
                        value.MonitorId)
                .ToArray()
        )
        {
            state.Values.Remove(
                monitorId);
        }
    }

    private static void
        PruneRuntimeChannelsLocked(
            DateTimeOffset now)
    {
        foreach (
            string channel in
            RuntimeChannels
                .Where(pair =>
                    now -
                        pair.Value
                            .LastSeenUtc >
                    RuntimeChannelRetention &&
                    !RuntimeSubscribers
                        .Values
                        .Any(
                            subscriber =>
                                string.Equals(
                                    subscriber
                                        .ChannelName,
                                    pair.Key,
                                    StringComparison
                                        .Ordinal)))
                .Select(pair =>
                    pair.Key)
                .ToArray()
        )
        {
            RuntimeChannels.Remove(
                channel);
        }

        if (
            RuntimeChannels.Count <=
            RuntimeMaximumChannels
        )
        {
            return;
        }

        foreach (
            string channel in
            RuntimeChannels
                .Values
                .OrderBy(
                    state =>
                        state.LastSeenUtc)
                .Take(
                    RuntimeChannels.Count -
                    RuntimeMaximumChannels)
                .Select(
                    state =>
                        state.Channel)
                .ToArray()
        )
        {
            RuntimeChannels.Remove(
                channel);
        }
    }

    private static void
        BroadcastRuntimeMessage(
            string channel,
            RuntimeSseMessage message)
    {
        RuntimeSseSubscriber[]
            subscribers;

        lock (RuntimeLock)
        {
            subscribers =
                RuntimeSubscribers
                    .Values
                    .Where(
                        subscriber =>
                            string.Equals(
                                subscriber
                                    .ChannelName,
                                channel,
                                StringComparison
                                    .Ordinal))
                    .ToArray();
        }

        foreach (
            RuntimeSseSubscriber subscriber in
            subscribers)
        {
            subscriber.Queue.Writer
                .TryWrite(
                    message);
        }
    }

    private static string
        CurrentRuntimeSnapshotJson(
            string channel)
    {
        lock (RuntimeLock)
        {
            return BuildRuntimeSnapshotJsonLocked(
                channel,
                DateTimeOffset.UtcNow);
        }
    }

    private static string
        BuildRuntimeSnapshotJsonLocked(
            string channel,
            DateTimeOffset now)
    {
        RuntimeChannels.TryGetValue(
            channel,
            out RuntimeChannelState? state);

        bool active =
            state is not null &&
            now -
                state.LastSeenUtc <=
            RuntimeActiveWindow;

        RuntimeDisplayRecord[] values =
            state?.Values
                .Values
                .OrderBy(
                    value =>
                        value.MonitorId,
                    StringComparer.Ordinal)
                .ToArray() ??
            Array.Empty<
                RuntimeDisplayRecord>();

        return JsonSerializer.Serialize(
            new
            {
                kind =
                    "snapshot",
                bridgeVersion =
                    RuntimeBridgeVersion,
                channel,
                active,
                sessionId =
                    state?.SessionId ??
                    "",
                sessionStartedAtUnixMilliseconds =
                    state?.SessionStartedAtUnixMilliseconds ??
                    0,
                startedAtUtc =
                    state?.StartedAtUtc,
                lastSeenUtc =
                    state?.LastSeenUtc,
                sequence =
                    Volatile.Read(
                        ref _runtimeSequence),
                values
            },
            JsonOptions);
    }

    private static int
        CurrentRuntimeChannelCount()
    {
        lock (RuntimeLock)
        {
            return RuntimeChannels.Count;
        }
    }

    private static int
        CurrentRuntimeSubscriberCount()
    {
        lock (RuntimeLock)
        {
            return RuntimeSubscribers.Count;
        }
    }

    private static void
        CompleteRuntimeSubscribers()
    {
        RuntimeSseSubscriber[]
            subscribers;

        lock (RuntimeLock)
        {
            subscribers =
                RuntimeSubscribers
                    .Values
                    .ToArray();
            RuntimeSubscribers.Clear();
        }

        foreach (
            RuntimeSseSubscriber subscriber in
            subscribers)
        {
            subscriber.Queue.Writer
                .TryComplete();
        }
    }

    private static Dictionary<string, string>
        ParseQueryString(
            string requestTarget)
    {
        Dictionary<string, string> result =
            new(
                StringComparer.OrdinalIgnoreCase);
        int queryIndex =
            requestTarget.IndexOf('?');

        if (
            queryIndex < 0 ||
            queryIndex >=
                requestTarget.Length - 1
        )
        {
            return result;
        }

        foreach (
            string pair in
            requestTarget[
                (queryIndex + 1)..
            ].Split(
                '&',
                StringSplitOptions
                    .RemoveEmptyEntries)
        )
        {
            string[] parts =
                pair.Split('=', 2);
            string key =
                DecodeQueryComponent(
                    parts[0]);
            string value =
                parts.Length > 1
                    ? DecodeQueryComponent(
                        parts[1])
                    : "";

            if (!string.IsNullOrWhiteSpace(
                    key))
            {
                result[key] =
                    value;
            }
        }

        return result;
    }

    private static string
        DecodeQueryComponent(
            string value)
    {
        try
        {
            return Uri.UnescapeDataString(
                value.Replace(
                    '+',
                    ' '));
        }
        catch
        {
            return value;
        }
    }

    private static async Task RunServerAsync(
        CancellationToken cancellationToken)
    {
        TcpListener? listener = null;

        for (
            int port = PreferredPort;
            port <= LastAllowedPort;
            port++
        )
        {
            try
            {
                listener =
                    new TcpListener(
                        IPAddress.Loopback,
                        port);
                listener.Start();
                _serverPort = port;
                break;
            }
            catch (SocketException)
            {
                listener?.Stop();
                listener = null;
            }
        }

        if (listener is null)
        {
            Msg(
                $"[API Catalog] No free loopback port in {PreferredPort}-{LastAllowedPort}.");
            return;
        }

        _listener = listener;

        Msg(
            $"[API Catalog] Live endpoint: http://127.0.0.1:{_serverPort}/resonite_api_catalog.json");
        Msg(
            $"[Runtime Bridge] SSE endpoint: http://127.0.0.1:{_serverPort}/runtime/events");

        try
        {
            while (!cancellationToken.IsCancellationRequested)
            {
                TcpClient client =
                    await listener.AcceptTcpClientAsync(
                        cancellationToken);

                _ = Task.Run(
                    () => HandleClientAsync(
                        client,
                        cancellationToken),
                    CancellationToken.None);
            }
        }
        catch (OperationCanceledException)
        {
        }
        catch (ObjectDisposedException)
        {
        }
        catch (Exception exception)
        {
            Msg(
                "[API Catalog] HTTP server failed: " +
                exception);
        }
        finally
        {
            listener.Stop();
        }
    }

    private static async Task HandleClientAsync(
        TcpClient client,
        CancellationToken cancellationToken)
    {
        using (client)
        {
            client.NoDelay = true;

            using NetworkStream stream =
                client.GetStream();
            using StreamReader reader =
                new(
                    stream,
                    Encoding.ASCII,
                    detectEncodingFromByteOrderMarks: false,
                    bufferSize: 4096,
                    leaveOpen: true);

            string? requestLine =
                await reader.ReadLineAsync(
                    cancellationToken);

            if (string.IsNullOrWhiteSpace(
                    requestLine))
            {
                return;
            }

            Dictionary<string, string> headers =
                new(
                    StringComparer.OrdinalIgnoreCase);

            for (int index = 0; index < 100; index++)
            {
                string? line =
                    await reader.ReadLineAsync(
                        cancellationToken);

                if (string.IsNullOrEmpty(line))
                {
                    break;
                }

                int separator =
                    line.IndexOf(':');

                if (separator > 0)
                {
                    headers[line[..separator].Trim()] =
                        line[(separator + 1)..]
                            .Trim();
                }
            }

            string[] parts =
                requestLine.Split(
                    ' ',
                    StringSplitOptions.RemoveEmptyEntries);

            if (parts.Length < 2)
            {
                await WriteResponseAsync(
                    stream,
                    400,
                    "Bad Request",
                    "text/plain; charset=utf-8",
                    "Bad request",
                    cancellationToken);
                return;
            }

            string method =
                parts[0].ToUpperInvariant();
            string requestTarget =
                parts[1];
            string path =
                requestTarget
                    .Split('?', 2)[0];
            Dictionary<string, string> query =
                ParseQueryString(
                    requestTarget);

            if (method == "OPTIONS")
            {
                await WriteResponseAsync(
                    stream,
                    204,
                    "No Content",
                    "text/plain; charset=utf-8",
                    "",
                    cancellationToken);
                return;
            }

            if (method != "GET")
            {
                await WriteResponseAsync(
                    stream,
                    405,
                    "Method Not Allowed",
                    "text/plain; charset=utf-8",
                    "Only GET and OPTIONS are supported.",
                    cancellationToken);
                return;
            }

            if (path == "/health")
            {
                string health =
                    JsonSerializer.Serialize(
                        new
                        {
                            ok = true,
                            port = _serverPort,
                            catalogReady =
                                CurrentCatalogJson()
                                    .Length > 2 &&
                                Volatile.Read(
                                    ref _successfulScanGeneration) ==
                                Volatile.Read(
                                    ref _requestedScanGeneration),
                            catalogAvailable =
                                CurrentCatalogJson()
                                    .Length > 2,
                            catalogRequestedGeneration =
                                Volatile.Read(
                                    ref _requestedScanGeneration),
                            catalogCompletedGeneration =
                                Volatile.Read(
                                    ref _completedScanGeneration),
                            catalogSuccessfulGeneration =
                                Volatile.Read(
                                    ref _successfulScanGeneration),
                            catalogFile =
                                CatalogFileName,
                            fingerprint =
                                CurrentCatalogFingerprint(),
                            catalogFingerprint =
                                CurrentCatalogFingerprint(),
                            catalogFingerprintVersion =
                                FingerprintContractVersion,
                            catalogFingerprintAlgorithm =
                                FingerprintAlgorithm,
                            assemblyFingerprint =
                                CurrentRuntimeAssemblyFingerprint(),
                            catalogAssemblyFingerprint =
                                CurrentCatalogAssemblyFingerprint(),
                            methodIdentityVersion =
                                MethodIdentityVersion,
                            methodIdentityAlgorithm =
                                MethodIdentityAlgorithm,
                            reloadSafetyContractVersion =
                                ReloadSafetyContractVersion,
                            reloadSafetyPolicy =
                                ReloadSafetyPolicy,
                            reloadSafetyMinimumReaderVersion =
                                ReloadSafetyMinimumReaderVersion,
                            reloadSafetyMaximumReaderVersion =
                                ReloadSafetyMaximumReaderVersion,
                            scannerVersion =
                                ScannerVersion,
                            scannerAssemblyVersion =
                                typeof(ResoniteApiCatalogScannerMod)
                                    .Assembly
                                    .GetName()
                                    .Version?
                                    .ToString() ??
                                "unknown",
                            scannerModuleVersionId =
                                typeof(ResoniteApiCatalogScannerMod)
                                    .Assembly
                                    .ManifestModule
                                    .ModuleVersionId
                                    .ToString("D"),
                            scannerAssemblyLocation =
                                typeof(ResoniteApiCatalogScannerMod)
                                    .Assembly
                                    .Location,
                            schemaVersion =
                                CatalogSchemaVersion,
                            suppressedDuplicateTypeDefinitions =
                                CurrentSuppressedDuplicateTypeDefinitions(),
                            runtimeBridgeVersion =
                                RuntimeBridgeVersion,
                            runtimeBridgeReady =
                                true,
                            runtimeChannels =
                                CurrentRuntimeChannelCount(),
                            runtimeSubscribers =
                                CurrentRuntimeSubscriberCount()
                        },
                        JsonOptions);

                await WriteResponseAsync(
                    stream,
                    200,
                    "OK",
                    "application/json; charset=utf-8",
                    health,
                    cancellationToken);
                return;
            }

            if (path == "/catalog/ready")
            {
                int generation =
                    await WaitForCatalogReadyAsync(
                        cancellationToken);
                string ready =
                    JsonSerializer.Serialize(
                        new
                        {
                            ready = true,
                            generation,
                            scannerVersion =
                                ScannerVersion,
                            catalogFingerprint =
                                CurrentCatalogFingerprint(),
                            assemblyFingerprint =
                                CurrentRuntimeAssemblyFingerprint(),
                            catalogAssemblyFingerprint =
                                CurrentCatalogAssemblyFingerprint()
                        },
                        JsonOptions);

                await WriteResponseAsync(
                    stream,
                    200,
                    "OK",
                    "application/json; charset=utf-8",
                    ready,
                    cancellationToken);
                return;
            }

            if (path == "/runtime/snapshot")
            {
                query.TryGetValue(
                    "channel",
                    out string? requestedChannel);
                string channel =
                    NormalizeRuntimeText(
                        requestedChannel,
                        240);

                if (string.IsNullOrWhiteSpace(
                        channel))
                {
                    await WriteResponseAsync(
                        stream,
                        400,
                        "Bad Request",
                        "application/json; charset=utf-8",
                        "{\"ok\":false,\"error\":\"A non-empty channel query parameter is required.\"}",
                        cancellationToken);
                    return;
                }

                await WriteResponseAsync(
                    stream,
                    200,
                    "OK",
                    "application/json; charset=utf-8",
                    CurrentRuntimeSnapshotJson(
                        channel),
                    cancellationToken);
                return;
            }

            if (path == "/runtime/events")
            {
                query.TryGetValue(
                    "channel",
                    out string? requestedChannel);
                string channel =
                    NormalizeRuntimeText(
                        requestedChannel,
                        240);

                if (string.IsNullOrWhiteSpace(
                        channel))
                {
                    await WriteResponseAsync(
                        stream,
                        400,
                        "Bad Request",
                        "application/json; charset=utf-8",
                        "{\"ok\":false,\"error\":\"A non-empty channel query parameter is required.\"}",
                        cancellationToken);
                    return;
                }

                await HandleRuntimeEventStreamAsync(
                    stream,
                    channel,
                    cancellationToken);
                return;
            }

            if (
                path != "/" &&
                path != "/resonite_api_catalog.json"
            )
            {
                await WriteResponseAsync(
                    stream,
                    404,
                    "Not Found",
                    "text/plain; charset=utf-8",
                    "Not found",
                    cancellationToken);
                return;
            }

            string json =
                CurrentCatalogJson();

            if (
                json.Length <= 2 ||
                Volatile.Read(
                    ref _successfulScanGeneration) !=
                Volatile.Read(
                    ref _requestedScanGeneration)
            )
            {
                await WriteResponseAsync(
                    stream,
                    503,
                    "Service Unavailable",
                    "application/json; charset=utf-8",
                    "{\"ready\":false}",
                    cancellationToken);
                return;
            }

            string etag =
                "\"" +
                CurrentCatalogFingerprint() +
                "\"";

            if (
                headers.TryGetValue(
                    "If-None-Match",
                    out string? requestedEtag) &&
                string.Equals(
                    requestedEtag,
                    etag,
                    StringComparison.Ordinal)
            )
            {
                await WriteResponseAsync(
                    stream,
                    304,
                    "Not Modified",
                    "application/json; charset=utf-8",
                    "",
                    cancellationToken,
                    etag);
                return;
            }

            bool acceptsGzip =
                headers.TryGetValue(
                    "Accept-Encoding",
                    out string? acceptEncoding) &&
                acceptEncoding.Contains(
                    "gzip",
                    StringComparison.OrdinalIgnoreCase);

            await WriteResponseAsync(
                stream,
                200,
                "OK",
                "application/json; charset=utf-8",
                json,
                cancellationToken,
                etag,
                acceptsGzip);
        }
    }

    private static string CurrentCatalogJson()
    {
        lock (StateLock)
        {
            return _catalogJson;
        }
    }

    private static string CurrentCatalogFingerprint()
    {
        lock (StateLock)
        {
            return _catalogFingerprint;
        }
    }

    private static string CurrentRuntimeAssemblyFingerprint()
    {
        lock (StateLock)
        {
            return _runtimeAssemblyFingerprint;
        }
    }

    private static string CurrentCatalogAssemblyFingerprint()
    {
        lock (StateLock)
        {
            return _assemblyFingerprint;
        }
    }

    private static int CurrentSuppressedDuplicateTypeDefinitions()
    {
        lock (StateLock)
        {
            return _suppressedDuplicateTypeDefinitions;
        }
    }

    private static TaskCompletionSource<int>
        NewCatalogReadySignal()
    {
        return new TaskCompletionSource<int>(
            TaskCreationOptions.RunContinuationsAsynchronously);
    }

    private static async Task<int>
        WaitForCatalogReadyAsync(
            CancellationToken cancellationToken)
    {
        while (true)
        {
            Task<int> signal;
            lock (StateLock)
            {
                if (
                    _catalogJson.Length > 2 &&
                    _successfulScanGeneration ==
                    _requestedScanGeneration
                )
                {
                    return _successfulScanGeneration;
                }

                signal =
                    _catalogReadySignal.Task;
            }

            await signal.WaitAsync(
                cancellationToken);
        }
    }


    private static async Task
        HandleRuntimeEventStreamAsync(
            NetworkStream stream,
            string channel,
            CancellationToken cancellationToken)
    {
        RuntimeSseSubscriber subscriber =
            new(
                channel);
        RuntimeSseMessage snapshot;

        lock (RuntimeLock)
        {
            RuntimeSubscribers[
                subscriber.Id
            ] = subscriber;

            snapshot =
                new RuntimeSseMessage(
                    Volatile.Read(
                        ref _runtimeSequence),
                    BuildRuntimeSnapshotJsonLocked(
                        channel,
                        DateTimeOffset.UtcNow));
        }

        try
        {
            await WriteRuntimeEventHeadersAsync(
                stream,
                cancellationToken);

            await WriteRuntimeSseMessageAsync(
                stream,
                snapshot,
                cancellationToken);

            while (
                !cancellationToken
                    .IsCancellationRequested)
            {
                while (
                    subscriber.Queue.Reader
                        .TryRead(
                            out RuntimeSseMessage?
                                message)
                )
                {
                    await WriteRuntimeSseMessageAsync(
                        stream,
                        message,
                        cancellationToken);
                }

                using CancellationTokenSource
                    heartbeatCancellation =
                        CancellationTokenSource
                            .CreateLinkedTokenSource(
                                cancellationToken);

                heartbeatCancellation
                    .CancelAfter(
                        TimeSpan.FromSeconds(
                            10));

                try
                {
                    bool available =
                        await subscriber.Queue.Reader
                            .WaitToReadAsync(
                                heartbeatCancellation
                                    .Token);

                    if (!available)
                    {
                        break;
                    }
                }
                catch (OperationCanceledException)
                    when (
                        !cancellationToken
                            .IsCancellationRequested)
                {
                    await WriteRuntimeHeartbeatAsync(
                        stream,
                        cancellationToken);
                }
            }
        }
        catch (OperationCanceledException)
        {
        }
        catch (IOException)
        {
        }
        catch (SocketException)
        {
        }
        catch (ObjectDisposedException)
        {
        }
        finally
        {
            lock (RuntimeLock)
            {
                RuntimeSubscribers.Remove(
                    subscriber.Id);
            }

            subscriber.Queue.Writer
                .TryComplete();
        }
    }

    private static async Task
        WriteRuntimeEventHeadersAsync(
            NetworkStream stream,
            CancellationToken cancellationToken)
    {
        string headers =
            "HTTP/1.1 200 OK\r\n" +
            "Content-Type: text/event-stream; charset=utf-8\r\n" +
            "Cache-Control: no-cache, no-store, max-age=0\r\n" +
            "Connection: keep-alive\r\n" +
            "Access-Control-Allow-Origin: *\r\n" +
            "Access-Control-Allow-Methods: GET, OPTIONS\r\n" +
            "Access-Control-Allow-Headers: Accept, Content-Type, If-None-Match, Last-Event-ID\r\n" +
            "Cross-Origin-Resource-Policy: cross-origin\r\n" +
            "Access-Control-Allow-Private-Network: true\r\n" +
            "X-Accel-Buffering: no\r\n" +
            "Vary: Origin\r\n" +
            "\r\n";

        await stream.WriteAsync(
            Encoding.ASCII.GetBytes(
                headers),
            cancellationToken);
        await stream.FlushAsync(
            cancellationToken);
    }

    private static async Task
        WriteRuntimeSseMessageAsync(
            NetworkStream stream,
            RuntimeSseMessage message,
            CancellationToken cancellationToken)
    {
        string payload =
            $"id: {message.Sequence}\n" +
            "retry: 1500\n" +
            $"data: {message.Json}\n\n";
        byte[] bytes =
            Encoding.UTF8.GetBytes(
                payload);

        await stream.WriteAsync(
            bytes,
            cancellationToken);
        await stream.FlushAsync(
            cancellationToken);
    }

    private static async Task
        WriteRuntimeHeartbeatAsync(
            NetworkStream stream,
            CancellationToken cancellationToken)
    {
        byte[] bytes =
            Encoding.ASCII.GetBytes(
                $": keep-alive {DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}\n\n");

        await stream.WriteAsync(
            bytes,
            cancellationToken);
        await stream.FlushAsync(
            cancellationToken);
    }

    private static async Task WriteResponseAsync(
        NetworkStream stream,
        int statusCode,
        string reason,
        string contentType,
        string body,
        CancellationToken cancellationToken,
        string? etag = null,
        bool compressWithGzip = false)
    {
        byte[] bodyBytes =
            Encoding.UTF8.GetBytes(
                body);
        bool compressed =
            compressWithGzip &&
            bodyBytes.Length >= 4096;

        if (compressed)
        {
            using MemoryStream compressedStream =
                new();

            using (
                GZipStream gzip =
                    new(
                        compressedStream,
                        CompressionLevel.Fastest,
                        leaveOpen: true)
            )
            {
                gzip.Write(
                    bodyBytes,
                    0,
                    bodyBytes.Length);
            }

            bodyBytes =
                compressedStream.ToArray();
        }

        StringBuilder header =
            new();
        header.Append(
            $"HTTP/1.1 {statusCode} {reason}\r\n");
        header.Append(
            $"Content-Type: {contentType}\r\n");
        header.Append(
            $"Content-Length: {bodyBytes.Length}\r\n");
        header.Append(
            "Connection: close\r\n");
        header.Append(
            "Cache-Control: no-store, max-age=0\r\n");
        header.Append(
            "Access-Control-Allow-Origin: *\r\n");
        header.Append(
            "Access-Control-Allow-Methods: GET, OPTIONS\r\n");
        header.Append(
            "Access-Control-Allow-Headers: Accept, Content-Type, If-None-Match, Last-Event-ID\r\n");
        header.Append(
            "Cross-Origin-Resource-Policy: cross-origin\r\n");
        header.Append(
            "Access-Control-Allow-Private-Network: true\r\n");
        header.Append(
            "Vary: Accept-Encoding, Origin\r\n");

        if (compressed)
        {
            header.Append(
                "Content-Encoding: gzip\r\n");
        }

        if (!string.IsNullOrWhiteSpace(etag))
        {
            header.Append(
                $"ETag: {etag}\r\n");
        }

        header.Append("\r\n");

        byte[] headerBytes =
            Encoding.ASCII.GetBytes(
                header.ToString());

        await stream.WriteAsync(
            headerBytes,
            cancellationToken);

        if (bodyBytes.Length > 0)
        {
            await stream.WriteAsync(
                bodyBytes,
                cancellationToken);
        }

        await stream.FlushAsync(
            cancellationToken);
    }


    private sealed class RuntimeValueDescription
    {
        public string Display { get; init; } = "";
        public string RuntimeType { get; init; } = "";
        public string ValueKind { get; init; } = "";
        public object? Value { get; init; }
        public string ValueFingerprint { get; init; } = "";
    }

    private sealed class RuntimeDisplayRecord
    {
        public string MonitorId { get; init; } = "";
        public string Label { get; init; } = "";
        public string GraphType { get; init; } = "";
        public string RuntimeType { get; init; } = "";
        public string ValueKind { get; init; } = "";
        public string Display { get; init; } = "";
        public object? Value { get; init; }
        public bool IsNull { get; init; }
        public long Sequence { get; init; }
        public DateTimeOffset UpdatedAtUtc { get; init; }

        [JsonIgnore]
        public DateTimeOffset LastBroadcastAtUtc { get; init; }

        [JsonIgnore]
        public string Fingerprint { get; init; } = "";
    }

    private sealed class RuntimeChannelState
    {
        public string Channel { get; init; } = "";
        public string SessionId { get; init; } = "";
        public long SessionStartedAtUnixMilliseconds { get; init; }
        public DateTimeOffset StartedAtUtc { get; init; }
        public DateTimeOffset LastSeenUtc { get; set; }
        public Dictionary<string, RuntimeDisplayRecord> Values { get; } =
            new(StringComparer.Ordinal);
    }

    private sealed class RuntimeSseMessage
    {
        public RuntimeSseMessage(
            long sequence,
            string json)
        {
            Sequence =
                sequence;
            Json =
                json;
        }

        public long Sequence { get; }
        public string Json { get; }
    }

    private sealed class RuntimeSseSubscriber
    {
        public RuntimeSseSubscriber(
            string channelName)
        {
            Id =
                Guid.NewGuid();
            ChannelName =
                channelName;
            Queue =
                System.Threading.Channels.Channel
                    .CreateBounded<
                        RuntimeSseMessage>(
                        new BoundedChannelOptions(
                            256)
                        {
                            SingleReader =
                                true,
                            SingleWriter =
                                false,
                            FullMode =
                                BoundedChannelFullMode
                                    .DropOldest
                        });
        }

        public Guid Id { get; }
        public string ChannelName { get; }
        public Channel<RuntimeSseMessage> Queue { get; }
    }

    private sealed class ApiCatalog
    {
        public int SchemaVersion { get; init; }
        public string CatalogKind { get; init; } = "";
        public string ScannerVersion { get; init; } = "";
        public DateTimeOffset GeneratedAtUtc { get; init; }
        public string EngineVersion { get; init; } = "";
        public string SourceAssembly { get; init; } = "";
        public string AssemblyFingerprint { get; init; } = "";
        public int CatalogFingerprintVersion { get; init; }
        public string CatalogFingerprintAlgorithm { get; init; } = "";
        public string CatalogFingerprint { get; set; } = "";
        public int MethodIdentityVersion { get; init; }
        public string MethodIdentityAlgorithm { get; init; } = "";
        public int ReloadSafetyContractVersion { get; init; }
        public string ReloadSafetyPolicy { get; init; } = "";
        public int ReloadSafetyMinimumReaderVersion { get; init; }
        public int ReloadSafetyMaximumReaderVersion { get; init; }
        public int SuppressedDuplicateTypeDefinitions { get; init; }
        public string? Endpoint { get; init; }
        public List<ApiAssemblyInfo> Assemblies { get; init; } = new();
        public List<string> Components { get; init; } = new();
        public List<string> Materials { get; init; } = new();
        public List<string> CommonMaterials { get; init; } = new();
        public List<string> Meshes { get; init; } = new();
        public List<ApiMethodInfo> SlotAttachOverloads { get; init; } = new();
        public List<ApiTypeInfo> Types { get; init; } = new();
        public List<ApiEnumInfo> Enums { get; init; } = new();
    }

    private sealed class ApiAssemblyInfo
    {
        public string Name { get; init; } = "";
        public string Version { get; init; } = "";
        public string? FullName { get; init; }
        public string? Location { get; init; }
        public List<string> ModuleVersionIds { get; init; } = new();
    }

    private sealed class ApiTypeInfo
    {
        public string FullName { get; init; } = "";
        public string Name { get; init; } = "";
        public string? Namespace { get; init; }
        public string Assembly { get; init; } = "";
        public string? ThreadAffinity { get; init; }
        public ApiReloadSafetyInfo TypeTokenReloadSafety { get; init; } = new();
        public ApiReloadSafetyInfo ReloadSafety { get; init; } = new();
        public string Kind { get; init; } = "";
        public string? BaseType { get; init; }
        public List<string> Interfaces { get; init; } = new();
        public List<string> Categories { get; init; } = new();
        public List<string> Attributes { get; init; } = new();
        public bool IsPublic { get; init; }
        public bool IsAbstract { get; init; }
        public bool IsSealed { get; init; }
        public bool IsStatic { get; init; }
        public bool IsGeneric { get; init; }
        public bool IsComponent { get; init; }
        public bool IsWorker { get; init; }
        public bool IsAttachableComponent { get; init; }
        public bool IsMaterial { get; init; }
        public bool IsCommonMaterial { get; init; }
        public bool IsMeshProvider { get; init; }
        public bool IsTextureProvider { get; init; }
        public bool IsAudioClipProvider { get; init; }
        public bool IsCollider { get; init; }
        public bool IsUiX { get; init; }
        public bool IsEditorNamed { get; init; }
        public bool IsToolNamed { get; init; }
        public bool IsGizmoNamed { get; init; }
        public bool IsPubliclyConstructible { get; init; }
        public bool HasPublicParameterlessConstructor { get; init; }
        public bool IsObsolete { get; init; }
        public bool IsLegacyNamed { get; init; }
        public bool IsDebugNamed { get; init; }
        public List<ApiConstructorInfo> Constructors { get; init; } = new();
        public List<ApiMethodInfo> Methods { get; init; } = new();
        public List<ApiPropertyInfo> Properties { get; init; } = new();
        public List<ApiFieldInfo> Fields { get; init; } = new();
        public List<ApiEventInfo> Events { get; init; } = new();
        public List<string>? EnumValues { get; init; }
    }

    private sealed class ApiConstructorInfo
    {
        public string DeclaringType { get; init; } = "";
        public string Signature { get; init; } = "";
        public List<ApiParameterInfo> Parameters { get; init; } = new();
        public string? ThreadAffinity { get; init; }
        public ApiReloadSafetyInfo ReloadSafety { get; init; } = new();
        public List<string> Attributes { get; init; } = new();
    }

    private sealed class ApiMethodInfo
    {
        public string Id { get; init; } = "";
        public string StableContractId { get; init; } = "";
        public string Name { get; init; } = "";
        public string DeclaringType { get; init; } = "";
        public string Signature { get; init; } = "";
        public string ReturnType { get; init; } = "";
        public bool ReturnTypeIsValueType { get; init; }
        public bool IsStatic { get; init; }
        public bool IsExtensionMethod { get; init; }
        public bool IsGenericMethodDefinition { get; init; }
        public bool IsObsolete { get; init; }
        public string? ThreadAffinity { get; init; }
        public ApiReloadSafetyInfo ReloadSafety { get; init; } = new();
        public List<ApiGenericParameterInfo> GenericParameters { get; init; } = new();
        public List<ApiParameterInfo> Parameters { get; init; } = new();
        public List<string> Attributes { get; init; } = new();
    }

    private sealed class ApiGenericParameterInfo
    {
        public string Name { get; init; } = "";
        public int Position { get; init; }
        public List<string> Constraints { get; init; } = new();
        public bool ReferenceTypeConstraint { get; init; }
        public bool ValueTypeConstraint { get; init; }
        public bool DefaultConstructorConstraint { get; init; }
    }

    private sealed class ApiParameterInfo
    {
        public string Name { get; init; } = "";
        public int Position { get; init; }
        public string Type { get; init; } = "";
        public string ElementType { get; init; } = "";
        public bool IsOut { get; init; }
        public bool IsByRef { get; init; }
        public bool IsIn { get; init; }
        public bool IsOptional { get; init; }
        public bool HasDefaultValue { get; init; }
        public string? DefaultValueCSharp { get; init; }
        public List<string> Attributes { get; init; } = new();
    }

    private sealed class ApiPropertyInfo
    {
        public string DeclaringType { get; init; } = "";
        public string Name { get; init; } = "";
        public string Type { get; init; } = "";
        public bool CanRead { get; init; }
        public bool CanWrite { get; init; }
        public bool IsStatic { get; init; }
        public bool IsObsolete { get; init; }
        public string? ThreadAffinity { get; init; }
        public ApiReloadSafetyInfo ReadReloadSafety { get; init; } = new();
        public ApiReloadSafetyInfo WriteReloadSafety { get; init; } = new();
        public List<ApiParameterInfo> IndexParameters { get; init; } = new();
        public List<string> Attributes { get; init; } = new();
    }

    private sealed class ApiFieldInfo
    {
        public string DeclaringType { get; init; } = "";
        public string Name { get; init; } = "";
        public string Type { get; init; } = "";
        public bool IsStatic { get; init; }
        public bool IsReadOnly { get; init; }
        public bool IsConst { get; init; }
        public bool IsObsolete { get; init; }
        public string? ConstantValueCSharp { get; init; }
        public string? ThreadAffinity { get; init; }
        public ApiReloadSafetyInfo ReadReloadSafety { get; init; } = new();
        public ApiReloadSafetyInfo WriteReloadSafety { get; init; } = new();
        public List<string> Attributes { get; init; } = new();
    }

    private sealed class ApiEventInfo
    {
        public string DeclaringType { get; init; } = "";
        public string Name { get; init; } = "";
        public string? HandlerType { get; init; }
        public bool IsStatic { get; init; }
        public bool IsObsolete { get; init; }
        public string? ThreadAffinity { get; init; }
        public ApiReloadSafetyInfo ReloadSafety { get; init; } = new();
        public List<string> Attributes { get; init; } = new();
    }

    private sealed class ApiReloadSafetyInfo
    {
        public int? RuleVersion { get; init; }
        public string Level { get; init; } = "unknown";
        public string? Confidence { get; init; }
        public string? Operation { get; init; }
        public string? ClassificationBasis { get; init; }
        public bool? RequiresExecutionProof { get; init; }
        public bool? RequiresUseSiteResolution { get; init; }
        public List<string>? UseSiteInputs { get; init; }
        public List<string>? Reasons { get; init; }
        public List<string>? RequiredCleanup { get; init; }
        public bool? RetainsCallerObjects { get; init; }
    }

    private sealed class ReloadSafetyAccumulator
    {
        private readonly string _operation;
        private int _severity;
        private bool? _retainsCallerObjects;
        private bool _requiresExecutionProof;
        private bool _requiresUseSiteResolution;
        private readonly HashSet<string> _reasons =
            new(StringComparer.Ordinal);
        private readonly HashSet<string> _requiredCleanup =
            new(StringComparer.Ordinal);
        private readonly HashSet<string> _useSiteInputs =
            new(StringComparer.Ordinal);

        public ReloadSafetyAccumulator(
            string operation)
        {
            _operation = operation;
        }

        public void Add(
            string level,
            string reason,
            string? requiredCleanup,
            bool? retainsCallerObjects)
        {
            _severity =
                Math.Max(
                    _severity,
                    ReloadSafetySeverity(level));

            if (!string.IsNullOrWhiteSpace(reason))
            {
                _reasons.Add(reason);
            }

            if (!string.IsNullOrWhiteSpace(requiredCleanup))
            {
                _requiredCleanup.Add(requiredCleanup);
            }

            if (retainsCallerObjects == true)
            {
                _retainsCallerObjects = true;
            }
            else if (_retainsCallerObjects is null &&
                     retainsCallerObjects == false)
            {
                _retainsCallerObjects = false;
            }
        }

        public void RequireExecutionProof()
        {
            _requiresExecutionProof = true;
        }

        public void RequireUseSiteResolution(
            params string[] inputs)
        {
            _requiresUseSiteResolution = true;
            foreach (string input in inputs)
            {
                if (!string.IsNullOrWhiteSpace(input))
                {
                    _useSiteInputs.Add(input);
                }
            }
        }

        public ApiReloadSafetyInfo Build()
        {
            string level =
                _severity switch
                {
                    >= 3 => "unsafe",
                    2 => "unknown",
                    1 => "conditional",
                    _ => "safe"
                };

            if (level == "safe")
            {
                return new ApiReloadSafetyInfo
                {
                    Level = "safe"
                };
            }

            bool requiresExecutionProof =
                level == "unknown" &&
                _requiresExecutionProof;
            bool requiresUseSiteResolution =
                level == "conditional" &&
                _requiresUseSiteResolution;

            return new ApiReloadSafetyInfo
            {
                RuleVersion =
                    ReloadSafetyContractVersion,
                Level = level,
                Confidence =
                    requiresExecutionProof
                        ? "runtime-proof-required"
                        : requiresUseSiteResolution
                            ? "use-site"
                            : "structural",
                Operation = _operation,
                ClassificationBasis =
                    requiresExecutionProof
                        ? "empirical-required"
                        : requiresUseSiteResolution
                            ? "use-site-dependent"
                            : "structural",
                RequiresExecutionProof =
                    requiresExecutionProof
                        ? true
                        : null,
                RequiresUseSiteResolution =
                    requiresUseSiteResolution
                        ? true
                        : null,
                UseSiteInputs =
                    requiresUseSiteResolution &&
                    _useSiteInputs.Count > 0
                        ? _useSiteInputs
                            .OrderBy(
                                value => value,
                                StringComparer.Ordinal)
                            .ToList()
                        : null,
                Reasons =
                    _reasons
                    .OrderBy(
                        value => value,
                        StringComparer.Ordinal)
                    .ToList(),
                RequiredCleanup =
                    _requiredCleanup
                        .OrderBy(
                            value => value,
                            StringComparer.Ordinal)
                        .ToList(),
                RetainsCallerObjects =
                    _retainsCallerObjects
            };
        }

        private static int ReloadSafetySeverity(
            string level)
        {
            return level switch
            {
                "unsafe" => 3,
                "unknown" => 2,
                "conditional" => 1,
                _ => 0
            };
        }
    }

    private sealed class ApiEnumInfo
    {
        public string FullName { get; init; } = "";
        public string? ThreadAffinity { get; init; }
        public ApiReloadSafetyInfo ValueReloadSafety { get; init; } = new();
        public string UnderlyingType { get; init; } = "";
        public bool IsFlags { get; init; }
        public bool IsObsolete { get; init; }
        public List<ApiEnumValueInfo> Values { get; init; } = new();
    }

    private sealed class ApiEnumValueInfo
    {
        public string Name { get; init; } = "";
        public string NumericValue { get; init; } = "";
    }
}
