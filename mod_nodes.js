(() => {
  "use strict";

  const registry = window.RMLModNodeRegistry;

  if (!registry) {
    console.error(
      "RML universal mod nodes require node_graph.js to be loaded first."
    );
    return;
  }

  const {
    port,
    genericPort,
    registerType,
    registerGroup,
    registerNode,
    patchNode,
    registerCodegenPlugin
  } = registry;

  const pText = (
    key,
    label,
    defaultValue = "",
    help = "",
    extra = {}
  ) => ({
    key,
    label,
    kind: "text",
    default: defaultValue,
    help,
    ...extra
  });

  const pCode = (
    key,
    label,
    defaultValue = "",
    help = "",
    rows = 8
  ) => ({
    key,
    label,
    kind: "code",
    default: defaultValue,
    help,
    rows,
    monospace: true,
    spellcheck: false
  });

  const pBool = (
    key,
    label,
    defaultValue = false,
    help = ""
  ) => ({
    key,
    label,
    kind: "bool",
    default: defaultValue,
    help
  });

  const pSelect = (
    key,
    label,
    options,
    defaultValue,
    help = "",
    extra = {}
  ) => ({
    key,
    label,
    kind: "select",
    options,
    default: defaultValue,
    help,
    ...extra
  });

  const pNumber = (
    key,
    label,
    defaultValue = 0,
    help = ""
  ) => ({
    key,
    label,
    kind: "number",
    default: defaultValue,
    storeAsNumber: true,
    help
  });

  const COMMON_VALUE_TYPES = [
    "bool",
    "string",
    "Uri",
    "int",
    "float",
    "double",
    "int2",
    "int3",
    "int4",
    "float2",
    "float3",
    "float4",
    "double2",
    "double3",
    "double4",
    "colorX",
    "object",
    "byteArray",
    "stringArray",
    "objectArray",
    "type",
    "memberInfo",
    "methodBase",
    "methodInfo",
    "fieldInfo",
    "propertyInfo",
    "exception",
    "engine",
    "world",
    "slot",
    "component",
    "uiBuilder",
    "uiElement",
    "asset",
    "texture",
    "material",
    "mesh",
    "audioClip",
    "json",
    "httpResponse",
    "webSocket",
    "task",
    "cancellationToken",
    "patchContext"
  ];

  const typeDefinitions = {
    object: {
      label: "Object",
      short: "OBJ",
      color: "#bcc7d2",
      csType: "object",
      defaultCs: "null!",
      acceptsAnyValue: true,
      referenceType: true,
      constraints: ["reference", "serializable"]
    },
    byteArray: {
      label: "Byte array",
      short: "BIN",
      color: "#d1ad73",
      csType: "byte[]",
      defaultCs: "Array.Empty<byte>()",
      referenceType: true,
      constraints: ["reference", "serializable"]
    },
    stringArray: {
      label: "String array",
      short: "TXT[]",
      color: "#ff96c9",
      csType: "string[]",
      defaultCs: "Array.Empty<string>()",
      referenceType: true,
      constraints: ["reference", "serializable"]
    },
    objectArray: {
      label: "Object array",
      short: "OBJ[]",
      color: "#aab5c0",
      csType: "object?[]",
      defaultCs: "Array.Empty<object?>()",
      referenceType: true,
      constraints: ["reference", "serializable"]
    },
    type: {
      label: "System.Type",
      short: "TYPE",
      color: "#76c6ff",
      csType: "Type",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["object"]
    },
    memberInfo: {
      label: "MemberInfo",
      short: "MEM",
      color: "#70bce8",
      csType: "MemberInfo",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["object"]
    },
    methodBase: {
      label: "MethodBase",
      short: "MBASE",
      color: "#5fb7ee",
      csType: "MethodBase",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["memberInfo", "object"]
    },
    methodInfo: {
      label: "MethodInfo",
      short: "METH",
      color: "#4eace6",
      csType: "MethodInfo",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["methodBase", "memberInfo", "object"]
    },
    fieldInfo: {
      label: "FieldInfo",
      short: "FIELD",
      color: "#4fc6c8",
      csType: "FieldInfo",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["memberInfo", "object"]
    },
    propertyInfo: {
      label: "PropertyInfo",
      short: "PROP",
      color: "#52d2b4",
      csType: "PropertyInfo",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["memberInfo", "object"]
    },
    exception: {
      label: "Exception",
      short: "EX",
      color: "#ff7188",
      csType: "Exception",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["object"]
    },
    patchContext: {
      label: "Harmony patch context",
      short: "PATCH",
      color: "#ef9e68",
      csType: "PatchContext",
      defaultCs: "new PatchContext()",
      referenceType: true,
      assignableTo: ["object"]
    },
    engine: {
      label: "Resonite Engine",
      short: "ENG",
      color: "#67d6ff",
      csType: "object",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["object"]
    },
    world: {
      label: "Resonite World",
      short: "WORLD",
      color: "#62e4c4",
      csType: "object",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["object"]
    },
    slot: {
      label: "Resonite Slot",
      short: "SLOT",
      color: "#8ae271",
      csType: "object",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["object"]
    },
    component: {
      label: "Resonite Component",
      short: "COMP",
      color: "#a4df64",
      csType: "object",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["object"]
    },
    uiBuilder: {
      label: "UIBuilder",
      short: "UIB",
      color: "#de8cff",
      csType: "object",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["object"]
    },
    uiElement: {
      label: "UI element",
      short: "UI",
      color: "#f18ce6",
      csType: "object",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["object"]
    },
    asset: {
      label: "Asset",
      short: "ASSET",
      color: "#f6c75c",
      csType: "object",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["object"]
    },
    texture: {
      label: "Texture",
      short: "TEX",
      color: "#ffb655",
      csType: "object",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["asset", "object"]
    },
    material: {
      label: "Material",
      short: "MAT",
      color: "#f4a261",
      csType: "object",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["asset", "object"]
    },
    mesh: {
      label: "Mesh",
      short: "MESH",
      color: "#dfbd69",
      csType: "object",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["asset", "object"]
    },
    audioClip: {
      label: "Audio clip",
      short: "AUD",
      color: "#d8d66a",
      csType: "object",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["asset", "object"]
    },
    json: {
      label: "JSON node",
      short: "JSON",
      color: "#e9c26b",
      csType: "JsonNode",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["object"]
    },
    httpResponse: {
      label: "HTTP response",
      short: "HTTP",
      color: "#53d4e8",
      csType: "GraphHttpResponse",
      defaultCs: "GraphHttpResponse.Empty",
      referenceType: true,
      assignableTo: ["object"]
    },
    webSocket: {
      label: "WebSocket",
      short: "WS",
      color: "#46cfe2",
      csType: "ClientWebSocket",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["object"]
    },
    task: {
      label: "Task",
      short: "TASK",
      color: "#b8a2ff",
      csType: "Task",
      defaultCs: "Task.CompletedTask",
      referenceType: true,
      assignableTo: ["object"]
    },
    cancellationToken: {
      label: "CancellationToken",
      short: "CANCEL",
      color: "#a395e8",
      csType: "CancellationToken",
      defaultCs: "CancellationToken.None"
    }
  };

  for (const [type, information] of Object.entries(typeDefinitions)) {
    registerType(type, information);
  }

  for (const [type, information] of Object.entries({
    dynamicVariableSpace: {
      label: "Dynamic Variable Space",
      short: "DVS",
      color: "#57d6b8",
      csType: "object",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["component", "object"]
    },
    radiantDash: {
      label: "Radiant Dash",
      short: "DASH",
      color: "#ffbd68",
      csType: "object",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["component", "object"]
    }
  })) {
    registerType(type, information);

    if (!COMMON_VALUE_TYPES.includes(type)) {
      COMMON_VALUE_TYPES.push(type);
    }
  }

  const groups = [
    ["Flow", { after: "Conversions" }],
    ["Lifecycle", { after: "Flow" }],
    ["Harmony", { after: "Lifecycle" }],
    ["Reflection", { after: "Harmony" }],
    ["Debug & Output", { after: "Reflection" }],
    ["Slots & Components", { after: "Debug & Output" }],
    ["UI", { after: "Slots & Components" }],
    ["Assets", { after: "UI" }],
    ["Files & JSON", { after: "Assets" }],
    ["Networking", { after: "Files & JSON" }],
    ["Tasks & Threading", { after: "Networking" }],
    ["C# Advanced", { after: "Tasks & Threading" }]
  ];

  for (const [name, options] of groups) {
    registerGroup(name, options);
  }

  patchNode("resonite.onStart", {
    title: "On Engine Init",
    group: "Lifecycle",
    description:
      "Fires once from the generated mod's OnEngineInit method."
  });
  patchNode("resonite.onSaved", {
    group: "Lifecycle"
  });
  patchNode("resonite.impulseRelay", {
    title: "Impulse Reroute",
    group: "Flow"
  });
  patchNode("resonite.valueRelay", {
    title: "Value Reroute",
    group: "Flow"
  });
  patchNode("resonite.displayValue", {
    group: "Debug & Output"
  });
  patchNode("resonite.store", {
    group: "Flow",
    title: "Local State Store"
  });
  patchNode("resonite.dataModelStore", {
    hiddenFromPalette: true,
    description:
      "Deprecated compatibility node. Use real Slot/Component/Sync nodes or Local State Store."
  });
  patchNode("resonite.dynamicRead", {
    hiddenFromPalette: true,
    description:
      "Deprecated graph-local dictionary node. Use Read Slot/Component Member for real Resonite state."
  });
  patchNode("resonite.dynamicWrite", {
    hiddenFromPalette: true,
    description:
      "Deprecated graph-local dictionary node. Use Write Slot/Component Member for real Resonite state."
  });
  for (const id of [
    "resonite.packFloat2",
    "resonite.packFloat3",
    "resonite.packFloat4",
    "resonite.unpackFloat3",
    "resonite.packColorX",
    "resonite.unpackColorX"
  ]) {
    patchNode(id, {
      group: "Values"
    });
  }

  function ensureReflectionRuntime(api) {
    api.addUsing("System.Collections");
    api.addUsing("System.Linq");

    api.addMember("universal.reflection", String.raw`
private const BindingFlags GraphAllMembers =
    BindingFlags.Public |
    BindingFlags.NonPublic |
    BindingFlags.Instance |
    BindingFlags.Static |
    BindingFlags.FlattenHierarchy;

private static Type? FindType(string? typeName)
{
    if (string.IsNullOrWhiteSpace(typeName))
    {
        return null;
    }

    Type? direct = Type.GetType(typeName, throwOnError: false, ignoreCase: false);
    if (direct is not null)
    {
        return direct;
    }

    foreach (Assembly assembly in AppDomain.CurrentDomain.GetAssemblies())
    {
        Type? candidate = assembly.GetType(typeName, throwOnError: false, ignoreCase: false);
        if (candidate is not null)
        {
            return candidate;
        }
    }

    string shortName = typeName.Contains('.')
        ? typeName[(typeName.LastIndexOf('.') + 1)..]
        : typeName;

    foreach (Assembly assembly in AppDomain.CurrentDomain.GetAssemblies())
    {
        try
        {
            Type? candidate = assembly
                .GetTypes()
                .FirstOrDefault(type =>
                    string.Equals(type.Name, shortName, StringComparison.Ordinal) ||
                    string.Equals(type.FullName, typeName, StringComparison.Ordinal));

            if (candidate is not null)
            {
                return candidate;
            }
        }
        catch (ReflectionTypeLoadException exception)
        {
            Type? candidate = exception.Types
                .Where(type => type is not null)
                .FirstOrDefault(type =>
                    string.Equals(type!.Name, shortName, StringComparison.Ordinal) ||
                    string.Equals(type.FullName, typeName, StringComparison.Ordinal));

            if (candidate is not null)
            {
                return candidate;
            }
        }
    }

    return null;
}

private static Type[] ResolveTypeList(string? commaSeparatedTypeNames)
{
    if (string.IsNullOrWhiteSpace(commaSeparatedTypeNames))
    {
        return Type.EmptyTypes;
    }

    return commaSeparatedTypeNames
        .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
        .Select(name => FindType(name) ?? typeof(object))
        .ToArray();
}

private static object? ReadMember(object? target, string? memberName)
{
    if (target is null || string.IsNullOrWhiteSpace(memberName))
    {
        return null;
    }

    Type type = target is Type staticType
        ? staticType
        : target.GetType();
    object? instance = target is Type ? null : target;

    PropertyInfo? property = type.GetProperty(memberName, GraphAllMembers);
    if (property is not null && property.GetIndexParameters().Length == 0)
    {
        return property.GetValue(instance);
    }

    FieldInfo? field = type.GetField(memberName, GraphAllMembers);
    if (field is not null)
    {
        return field.GetValue(instance);
    }

    return null;
}

private static object? ReadMemberPath(object? target, string? memberPath)
{
    object? current = target;

    foreach (string part in (memberPath ?? string.Empty)
        .Split('.', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
    {
        current = ReadMember(current, part);
        if (current is null)
        {
            break;
        }
    }

    return current;
}

private static bool WriteMember(object? target, string? memberName, object? value)
{
    if (target is null || string.IsNullOrWhiteSpace(memberName))
    {
        return false;
    }

    Type type = target is Type staticType
        ? staticType
        : target.GetType();
    object? instance = target is Type ? null : target;

    PropertyInfo? property = type.GetProperty(memberName, GraphAllMembers);
    if (property?.CanWrite == true)
    {
        property.SetValue(instance, ConvertGraphValue(value, property.PropertyType));
        return true;
    }

    FieldInfo? field = type.GetField(memberName, GraphAllMembers);
    if (field is not null)
    {
        field.SetValue(instance, ConvertGraphValue(value, field.FieldType));
        return true;
    }

    return false;
}

private static object? ConvertGraphValue(object? value, Type destinationType)
{
    Type targetType = Nullable.GetUnderlyingType(destinationType) ?? destinationType;

    if (value is null)
    {
        return targetType.IsValueType
            ? Activator.CreateInstance(targetType)
            : null;
    }

    if (targetType.IsInstanceOfType(value))
    {
        return value;
    }

    if (targetType.IsEnum)
    {
        return value is string text
            ? Enum.Parse(targetType, text, ignoreCase: true)
            : Enum.ToObject(targetType, value);
    }

    if (targetType == typeof(Uri))
    {
        return new Uri(Convert.ToString(value, CultureInfo.InvariantCulture) ?? string.Empty,
            UriKind.RelativeOrAbsolute);
    }

    return Convert.ChangeType(value, targetType, CultureInfo.InvariantCulture);
}

private static T ConvertGraphValue<T>(object? value)
{
    object? converted = ConvertGraphValue(value, typeof(T));
    return converted is T typed ? typed : default!;
}

private static bool TryPrepareArguments(
    ParameterInfo[] parameters,
    object?[] supplied,
    out object?[] prepared)
{
    prepared = Array.Empty<object?>();

    int required = parameters.Count(parameter => !parameter.IsOptional);
    if (supplied.Length < required || supplied.Length > parameters.Length)
    {
        return false;
    }

    prepared = new object?[parameters.Length];

    try
    {
        for (int index = 0; index < parameters.Length; index++)
        {
            if (index < supplied.Length)
            {
                prepared[index] = ConvertGraphValue(
                    supplied[index],
                    parameters[index].ParameterType.IsByRef
                        ? parameters[index].ParameterType.GetElementType()!
                        : parameters[index].ParameterType);
            }
            else
            {
                prepared[index] = parameters[index].DefaultValue;
            }
        }

        return true;
    }
    catch
    {
        prepared = Array.Empty<object?>();
        return false;
    }
}

private static MethodInfo? FindMethod(
    Type? type,
    string? methodName,
    Type[]? parameterTypes = null)
{
    if (type is null || string.IsNullOrWhiteSpace(methodName))
    {
        return null;
    }

    if (parameterTypes is { Length: > 0 })
    {
        return type.GetMethod(
            methodName,
            GraphAllMembers,
            binder: null,
            types: parameterTypes,
            modifiers: null);
    }

    return type
        .GetMethods(GraphAllMembers)
        .FirstOrDefault(method =>
            string.Equals(method.Name, methodName, StringComparison.Ordinal));
}

private static object? InvokeBest(
    object? target,
    string? methodName,
    params object?[] arguments)
{
    if (target is null || string.IsNullOrWhiteSpace(methodName))
    {
        return null;
    }

    Type type = target is Type staticType
        ? staticType
        : target.GetType();
    object? instance = target is Type ? null : target;

    foreach (MethodInfo method in type
        .GetMethods(GraphAllMembers)
        .Where(method => string.Equals(method.Name, methodName, StringComparison.Ordinal))
        .OrderBy(method => method.GetParameters().Length))
    {
        if (method.ContainsGenericParameters)
        {
            continue;
        }

        if (!TryPrepareArguments(method.GetParameters(), arguments, out object?[] prepared))
        {
            continue;
        }

        return method.Invoke(instance, prepared);
    }

    return null;
}

private static object? InvokeMethodInfo(
    MethodInfo? method,
    object? target,
    object?[]? arguments)
{
    if (method is null)
    {
        return null;
    }

    object?[] supplied = arguments ?? Array.Empty<object?>();
    if (!TryPrepareArguments(method.GetParameters(), supplied, out object?[] prepared))
    {
        throw new ArgumentException($"Arguments do not match {method.DeclaringType?.FullName}.{method.Name}.");
    }

    return method.Invoke(target, prepared);
}

private static object? CreateReflective(Type? type, object?[]? arguments)
{
    if (type is null)
    {
        return null;
    }

    object?[] supplied = arguments ?? Array.Empty<object?>();

    foreach (ConstructorInfo constructor in type
        .GetConstructors(GraphAllMembers)
        .OrderBy(constructor => constructor.GetParameters().Length))
    {
        if (!TryPrepareArguments(constructor.GetParameters(), supplied, out object?[] prepared))
        {
            continue;
        }

        return constructor.Invoke(prepared);
    }

    return Activator.CreateInstance(type);
}

private static object?[] ToObjectArray(object? value)
{
    if (value is null)
    {
        return Array.Empty<object?>();
    }

    if (value is object?[] array)
    {
        return array;
    }

    if (value is IEnumerable enumerable && value is not string)
    {
        return enumerable.Cast<object?>().ToArray();
    }

    return new[] { value };
}
`);
  }

  function ensureEventRuntime(api) {
    ensureReflectionRuntime(api);
    api.addUsing("System.Linq.Expressions");
    api.addField(
      "universal.event.subscriptions",
      "private static readonly List<(object Target, EventInfo Event, Delegate Handler)> _graphEventSubscriptions = new();"
    );
    api.addMember("universal.event.helpers", String.raw`
private static Delegate? SubscribeGraphEvent(
    object? target,
    string? eventName,
    Action<object?[]> callback)
{
    if (target is null || string.IsNullOrWhiteSpace(eventName))
    {
        return null;
    }

    EventInfo? eventInfo = target
        .GetType()
        .GetEvent(eventName, GraphAllMembers);
    Type? handlerType = eventInfo?.EventHandlerType;
    MethodInfo? invoke = handlerType?.GetMethod("Invoke");

    if (eventInfo is null || handlerType is null || invoke is null)
    {
        return null;
    }

    ParameterExpression[] parameters = invoke
        .GetParameters()
        .Select(parameter => Expression.Parameter(parameter.ParameterType, parameter.Name))
        .ToArray();

    NewArrayExpression values = Expression.NewArrayInit(
        typeof(object),
        parameters.Select(parameter => Expression.Convert(parameter, typeof(object))));

    InvocationExpression body = Expression.Invoke(
        Expression.Constant(callback),
        values);

    Delegate handler = Expression
        .Lambda(handlerType, body, parameters)
        .Compile();

    eventInfo.AddEventHandler(target, handler);
    _graphEventSubscriptions.Add((target, eventInfo, handler));
    return handler;
}

private static void UnsubscribeGraphEvents()
{
    foreach ((object target, EventInfo eventInfo, Delegate handler) in _graphEventSubscriptions)
    {
        try
        {
            eventInfo.RemoveEventHandler(target, handler);
        }
        catch
        {
        }
    }

    _graphEventSubscriptions.Clear();
}
`);
  }

  function ensureResoniteRuntime(api) {
    ensureReflectionRuntime(api);
    api.addMember("universal.resonite.helpers", String.raw`
private static object? CurrentEngine()
{
    Type? engineType = FindType("FrooxEngine.Engine");
    return engineType is null
        ? null
        : ReadMember(engineType, "Current");
}

private static object? CurrentUserspaceWorld()
{
    object? engine = CurrentEngine();
    return ReadMemberPath(engine, "WorldManager.UserspaceWorld") ??
           ReadMemberPath(engine, "WorldManager.Userspace");
}

private static object? CurrentFocusedWorld()
{
    object? engine = CurrentEngine();
    return ReadMemberPath(engine, "WorldManager.FocusedWorld") ??
           ReadMemberPath(engine, "WorldManager.LocalWorld") ??
           CurrentUserspaceWorld();
}

private static object? CurrentLocalUser(object? world)
{
    return ReadMember(world, "LocalUser") ??
           ReadMemberPath(world, "Userspace.LocalUser");
}

private static IEnumerable<object> EnumerateObjects(object? value)
{
    if (value is IEnumerable enumerable && value is not string)
    {
        foreach (object? item in enumerable)
        {
            if (item is not null)
            {
                yield return item;
            }
        }
    }
}

private static object? FindSlotRecursive(object? root, string? nameOrPath)
{
    if (root is null || string.IsNullOrWhiteSpace(nameOrPath))
    {
        return null;
    }

    string requested = nameOrPath.Trim();
    string currentName = Convert.ToString(ReadMember(root, "Name"), CultureInfo.InvariantCulture) ?? string.Empty;

    if (string.Equals(currentName, requested, StringComparison.OrdinalIgnoreCase))
    {
        return root;
    }

    object? direct = InvokeBest(root, "FindChild", requested) ??
                     InvokeBest(root, "FindChild", requested, true);
    if (direct is not null)
    {
        return direct;
    }

    foreach (object child in EnumerateObjects(ReadMember(root, "Children")))
    {
        object? found = FindSlotRecursive(child, requested);
        if (found is not null)
        {
            return found;
        }
    }

    return null;
}

private static object? WorldRootSlot(object? world)
{
    return ReadMember(world, "RootSlot") ??
           ReadMember(world, "Root") ??
           ReadMemberPath(world, "Slots.Root");
}

private static object? AddSlotReflective(object? parent, string? name)
{
    if (parent is null)
    {
        return null;
    }

    return InvokeBest(parent, "AddSlot", name ?? "Slot") ??
           InvokeBest(parent, "AddChild", name ?? "Slot");
}

private static bool DestroyReflective(object? target)
{
    if (target is null)
    {
        return false;
    }

    foreach (string methodName in new[] { "Destroy", "DestroyPersistent", "Dispose" })
    {
        MethodInfo? method = target
            .GetType()
            .GetMethods(GraphAllMembers)
            .FirstOrDefault(candidate =>
                candidate.Name == methodName &&
                candidate.GetParameters().Length == 0);

        if (method is null)
        {
            continue;
        }

        method.Invoke(target, null);
        return true;
    }

    return false;
}

private static object? FindComponentReflective(object? slot, Type? componentType)
{
    if (slot is null || componentType is null)
    {
        return null;
    }

    object? direct = InvokeBest(slot, "GetComponent", componentType);
    if (direct is not null)
    {
        return direct;
    }

    return EnumerateObjects(ReadMember(slot, "Components"))
        .FirstOrDefault(component => componentType.IsInstanceOfType(component));
}

private static object? AttachComponentReflective(object? slot, Type? componentType)
{
    if (slot is null || componentType is null)
    {
        return null;
    }

    object? direct = InvokeBest(slot, "AttachComponent", componentType);
    if (direct is not null)
    {
        return direct;
    }

    MethodInfo? generic = slot
        .GetType()
        .GetMethods(GraphAllMembers)
        .FirstOrDefault(method =>
            method.Name == "AttachComponent" &&
            method.IsGenericMethodDefinition &&
            method.GetGenericArguments().Length == 1 &&
            method.GetParameters().Length == 0);

    return generic?
        .MakeGenericMethod(componentType)
        .Invoke(slot, null);
}

private static object? ReadSyncMember(object? target, string? memberPath)
{
    object? member = ReadMemberPath(target, memberPath);
    return ReadMember(member, "Value") ?? member;
}

private static bool WriteSyncMember(object? target, string? memberPath, object? value)
{
    if (target is null || string.IsNullOrWhiteSpace(memberPath))
    {
        return false;
    }

    string[] parts = memberPath
        .Split('.', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
    object? owner = target;

    for (int index = 0; index < parts.Length - 1; index++)
    {
        owner = ReadMember(owner, parts[index]);
        if (owner is null)
        {
            return false;
        }
    }

    string finalName = parts.Length > 0 ? parts[^1] : memberPath;
    object? member = ReadMember(owner, finalName);

    if (member is not null && WriteMember(member, "Value", value))
    {
        return true;
    }

    return WriteMember(owner, finalName, value);
}

private static object? ReadDynamicVariableReflective(
    object? space,
    string? name)
{
    if (space is null || string.IsNullOrWhiteSpace(name))
    {
        return null;
    }

    foreach (string methodName in new[]
    {
        "ReadValue",
        "GetValue",
        "Read",
        "Get"
    })
    {
        try
        {
            object? value = InvokeBest(space, methodName, name);
            if (value is not null)
            {
                return ReadMember(value, "Value") ?? value;
            }
        }
        catch
        {
        }
    }

    return ReadSyncMember(space, name);
}

private static bool WriteDynamicVariableReflective(
    object? space,
    string? name,
    object? value)
{
    if (space is null || string.IsNullOrWhiteSpace(name))
    {
        return false;
    }

    foreach (string methodName in new[]
    {
        "WriteValue",
        "SetValue",
        "Write",
        "Set"
    })
    {
        try
        {
            object? result = InvokeBest(space, methodName, name, value);
            if (result is bool boolean)
            {
                return boolean;
            }

            if (result is not null)
            {
                return true;
            }
        }
        catch
        {
        }
    }

    return WriteSyncMember(space, name, value);
}

private static object? CurrentRadiantDash()
{
    object? engine = CurrentEngine();
    object? direct =
        ReadMemberPath(engine, "RadiantDash") ??
        ReadMemberPath(engine, "WorldManager.UserspaceWorld.RadiantDash") ??
        ReadMemberPath(engine, "WorldManager.UserspaceWorld.UserspaceRadiantDash");

    if (direct is not null)
    {
        return direct;
    }

    Type? dashType =
        FindType("FrooxEngine.RadiantDash") ??
        FindType("FrooxEngine.UIX.RadiantDash");

    return FindComponentReflective(
        WorldRootSlot(CurrentUserspaceWorld()),
        dashType);
}

private static object? OpenRadiantDashModalReflective(
    object? dash,
    object? size,
    string? title)
{
    object? host = ReadMember(dash, "Slot") ?? dash;
    return InvokeBest(host, "OpenModalOverlay", size, title ?? string.Empty) ??
           InvokeBest(dash, "OpenModalOverlay", size, title ?? string.Empty);
}

private static object? CreateUiBuilderReflective(object? slot)
{
    Type? builderType = FindType("FrooxEngine.UIX.UIBuilder");
    return CreateReflective(builderType, new[] { slot });
}

private static object? CreateUiElementReflective(
    object? builder,
    string? methodName,
    params object?[] arguments)
{
    return InvokeBest(builder, methodName, arguments);
}

private static void DispatchToResonite(Action action)
{
    object? engine = CurrentEngine();

    foreach (string methodName in new[]
    {
        "RunPostInit",
        "RunSynchronously",
        "Schedule",
        "Enqueue"
    })
    {
        try
        {
            object? result = InvokeBest(engine, methodName, action);
            if (result is not null)
            {
                return;
            }
        }
        catch
        {
        }
    }

    action();
}
`);
  }

  function ensureJsonRuntime(api) {
    api.addUsing("System.Text.Json");
    api.addUsing("System.Text.Json.Nodes");
    api.addMember("universal.json.helpers", String.raw`
private static JsonNode? ParseGraphJson(string? text)
{
    return string.IsNullOrWhiteSpace(text)
        ? null
        : JsonNode.Parse(text);
}

private static string SerializeGraphJson(object? value, bool indented = false)
{
    return JsonSerializer.Serialize(
        value,
        new JsonSerializerOptions
        {
            WriteIndented = indented
        });
}

private static JsonNode? ReadGraphJsonProperty(JsonNode? node, string? path)
{
    JsonNode? current = node;

    foreach (string part in (path ?? string.Empty)
        .Split('.', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
    {
        if (current is JsonObject jsonObject)
        {
            current = jsonObject[part];
        }
        else if (current is JsonArray jsonArray && int.TryParse(part, out int index) &&
                 index >= 0 && index < jsonArray.Count)
        {
            current = jsonArray[index];
        }
        else
        {
            return null;
        }
    }

    return current;
}

private static string GraphJsonAsString(JsonNode? node)
{
    if (node is null)
    {
        return string.Empty;
    }

    try
    {
        return node.GetValue<string>();
    }
    catch
    {
        return node.ToJsonString();
    }
}
`);
  }

  function ensureNetworkRuntime(api) {
    api.addUsing("System.Net");
    api.addUsing("System.Net.Http");
    api.addUsing("System.Net.Http.Headers");
    api.addUsing("System.Net.Sockets");
    api.addUsing("System.Net.WebSockets");
    api.addUsing("System.Text");
    api.addUsing("System.Threading");
    api.addUsing("System.Threading.Tasks");
    api.addField(
      "universal.network.httpClient",
      "private static readonly HttpClient _graphHttpClient = new();"
    );
    api.addMember("universal.network.response", String.raw`
internal sealed record GraphHttpResponse(
    int StatusCode,
    string Body,
    string ContentType,
    bool Success,
    string Error)
{
    public static readonly GraphHttpResponse Empty =
        new(0, string.Empty, string.Empty, false, string.Empty);
}
`);
  }

  function ensureTaskRuntime(api) {
    api.addUsing("System.Threading");
    api.addUsing("System.Threading.Tasks");
    api.addMember("universal.task.helpers", String.raw`
private static void RunGraphBackground(Action action)
{
    _ = Task.Run(action);
}
`);
  }

  function ensureHarmonyRuntime(api) {
    ensureReflectionRuntime(api);
    api.addUsing("HarmonyLib");
    api.addReference({
      include: "0Harmony",
      hintPath:
        "$(ResonitePath)Libraries/0Harmony.dll",
      private: false
    });
    api.addField(
      "universal.harmony.field",
      `private static readonly Harmony _graphHarmony = new("${api.escapeString(
        `${api.namespaceName}.${api.className}.GeneratedGraph`
      )}");`
    );
    api.addMember("universal.harmony.context", String.raw`
internal sealed class PatchContext
{
    public object? Instance { get; set; }
    public object?[] Arguments { get; set; } = Array.Empty<object?>();
    public MethodBase? OriginalMethod { get; set; }
    public object? Result { get; set; }
    public Exception? Exception { get; set; }
    public bool SkipOriginal { get; set; }
}
`);
    api.addMember(
      "universal.harmony.helpers",
      String.raw`
private static MethodBase? ResolveHarmonyTarget(
    string? typeName,
    string? methodName,
    string? argumentTypeNames)
{
    Type? targetType = FindType(typeName);
    if (targetType is null || string.IsNullOrWhiteSpace(methodName))
    {
        return null;
    }

    Type[] argumentTypes = ResolveTypeList(argumentTypeNames);

    if (methodName is ".ctor" or "ctor")
    {
        return argumentTypes.Length > 0
            ? targetType.GetConstructor(GraphAllMembers, null, argumentTypes, null)
            : targetType.GetConstructors(GraphAllMembers).FirstOrDefault();
    }

    if (methodName is ".cctor" or "cctor")
    {
        return targetType.TypeInitializer;
    }

    return argumentTypes.Length > 0
        ? targetType.GetMethod(methodName, GraphAllMembers, null, argumentTypes, null)
        : targetType.GetMethods(GraphAllMembers)
            .FirstOrDefault(method => method.Name == methodName);
}

private static bool RegisterGeneratedHarmonyPatch(
    string typeName,
    string methodName,
    string argumentTypeNames,
    string patchKind,
    string callbackMethod,
    int priority)
{
    try
    {
        MethodBase? target = ResolveHarmonyTarget(typeName, methodName, argumentTypeNames);
        MethodInfo? callback = typeof(__GRAPH_CLASS__)
            .GetMethod(callbackMethod, GraphAllMembers);

        if (target is null || callback is null)
        {
            _display(
                $"Harmony target not found: {typeName}.{methodName} / {callbackMethod}");
            return false;
        }

        HarmonyMethod patch = new(callback)
        {
            priority = priority
        };

        switch ((patchKind ?? string.Empty).Trim().ToLowerInvariant())
        {
            case "prefix":
                _graphHarmony.Patch(target, prefix: patch);
                break;
            case "postfix":
                _graphHarmony.Patch(target, postfix: patch);
                break;
            case "finalizer":
                _graphHarmony.Patch(target, finalizer: patch);
                break;
            case "transpiler":
                _graphHarmony.Patch(target, transpiler: patch);
                break;
            default:
                _display($"Unsupported Harmony patch kind: {patchKind}");
                return false;
        }

        return true;
    }
    catch (Exception exception)
    {
        _display(
            $"Harmony patch failed for {typeName}.{methodName}: {exception}");
        return false;
    }
}

private static void CreateGeneratedReversePatch(
    string targetTypeName,
    string targetMethodName,
    string targetArgumentTypeNames,
    string standInTypeName,
    string standInMethodName)
{
    MethodBase? target = ResolveHarmonyTarget(
        targetTypeName,
        targetMethodName,
        targetArgumentTypeNames);
    Type? standInType = FindType(standInTypeName);
    MethodInfo? standIn = standInType?.GetMethod(standInMethodName, GraphAllMembers);

    if (target is null || standIn is null)
    {
        throw new MissingMethodException(
            "The reverse-patch target or stand-in method could not be resolved.");
    }

    _graphHarmony
        .CreateReversePatcher(target, new HarmonyMethod(standIn))
        .Patch();
}
`.replaceAll("__GRAPH_CLASS__", api.graphClassName)
    );
  }

  function nodeToken(api) {
    return api.token(api.node.id);
  }

  function quote(api, value) {
    return `"${api.escapeString(value ?? "")}"`;
  }

  function replaceCodePlaceholders(
    source,
    api,
    extra = {}
  ) {
    let code = String(source || "");
    const replacements = {
      MOD: api.className,
      GRAPH: api.graphClassName,
      NAMESPACE: api.namespaceName,
      NODE: api.identifier(
        api.node?.label ||
          api.definition?.title ||
          "Node"
      ),
      ...extra
    };

    for (const [name, value] of Object.entries(replacements)) {
      code = code.replaceAll(
        `{${name}}`,
        String(value ?? "")
      );
    }

    return code;
  }

  function replaceInputPlaceholders(
    source,
    api,
    portIds
  ) {
    const values = {};

    for (const portId of portIds) {
      values[portId.toUpperCase()] =
        api.input(portId).code;
    }

    return replaceCodePlaceholders(
      source,
      api,
      values
    );
  }

  function addStatefulField(
    api,
    suffix,
    csType,
    defaultCode
  ) {
    const token = nodeToken(api);
    const field = `_${suffix}${token}`;
    api.addField(
      `${api.node.id}.${suffix}`,
      `private static ${csType} ${field} = ${defaultCode};`
    );
    return field;
  }

  registerNode("constant.uri", {
    title: "URI Constant",
    group: "Values",
    symbol: "URI",
    description:
      "Creates a System.Uri from an absolute or relative string.",
    parameterKind: "string",
    outputs: [port("value", "URI", "Uri")],
    codegenExpression(api) {
      return `new Uri(${quote(api, api.node.parameters.value)}, UriKind.RelativeOrAbsolute)`;
    },
    previewEvaluate({ node, known }) {
      return known(
        "Uri",
        String(node.parameters?.value || "")
      );
    }
  });

  registerNode("constant.nullObject", {
    title: "Null Object",
    group: "Values",
    symbol: "∅",
    description:
      "A null object reference for optional reflection/API arguments.",
    outputs: [port("value", "Null", "object")],
    codegenExpression() {
      return "null!";
    },
    previewEvaluate({ known }) {
      return known("object", null);
    }
  });

  registerNode("constant.stringArray", {
    title: "String Array Constant",
    group: "Values",
    symbol: "T[]",
    description:
      "Splits one line per item into a string array.",
    parameters: [
      pCode(
        "items",
        "Items (one per line)",
        "System.String\nSystem.Int32",
        "Empty lines are ignored.",
        5
      )
    ],
    outputs: [port("value", "Values", "stringArray")],
    codegenExpression(api) {
      const items = String(
        api.node.parameters.items || ""
      )
        .split(/\r?\n/)
        .map(value => value.trim())
        .filter(Boolean)
        .map(value => quote(api, value));
      return `new string[] { ${items.join(", ")} }`;
    }
  });

  registerNode("constant.objectArray", {
    title: "Pack Object Array",
    group: "Values",
    symbol: "OBJ[]",
    description:
      "Packs up to eight differently typed values into object?[].",
    inputs: [
      port("a", "A", "object"),
      port("b", "B", "object"),
      port("c", "C", "object"),
      port("d", "D", "object"),
      port("e", "E", "object"),
      port("f", "F", "object"),
      port("g", "G", "object"),
      port("h", "H", "object")
    ],
    outputs: [port("value", "Array", "objectArray")],
    codegenExpression(api) {
      return `new object?[] { ${[
        "a",
        "b",
        "c",
        "d",
        "e",
        "f",
        "g",
        "h"
      ].map(id => api.input(id).code).join(", ")} }`;
    }
  });

  registerNode("constant.vector", {
    title: "Vector Constant",
    group: "Values",
    symbol: "VEC",
    description:
      "A typed int/float/double vector constant.",
    configurableTypeVar: "T",
    configurableTypes: [
      "int2",
      "int3",
      "int4",
      "float2",
      "float3",
      "float4",
      "double2",
      "double3",
      "double4"
    ],
    defaultType: "float3",
    parameters: [
      pText(
        "components",
        "Components",
        "0, 0, 0",
        "Comma-separated numeric components."
      )
    ],
    outputs: [
      genericPort(
        "value",
        "Value",
        "T",
        "arithmetic"
      )
    ],
    codegenExpression(api) {
      const type =
        api.node.parameters.valueType ||
        "float3";
      const count = Number(type.slice(-1));
      const scalar = type.startsWith("int")
        ? "int"
        : type.startsWith("double")
          ? "double"
          : "float";
      const parts = String(
        api.node.parameters.components || ""
      )
        .split(",")
        .map(value => value.trim())
        .filter(Boolean);
      while (parts.length < count) {
        parts.push("0");
      }
      return `new ${type}(${parts
        .slice(0, count)
        .map(value => api.numberLiteral(value, scalar))
        .join(", ")})`;
    }
  });

  registerNode("flow.sequence", {
    title: "Sequence",
    group: "Flow",
    symbol: "1→3",
    description:
      "Invokes up to four impulse paths in deterministic order.",
    inputs: [port("call", "Call", "impulse")],
    outputs: [
      port("first", "First", "impulse"),
      port("second", "Second", "impulse"),
      port("third", "Third", "impulse"),
      port("fourth", "Fourth", "impulse")
    ],
    codegenAction(api) {
      return ["first", "second", "third", "fourth"]
        .map(api.emit)
        .filter(Boolean)
        .map(method => `${method}();`)
        .join("\n");
    }
  });

  registerNode("flow.branch", {
    title: "Branch",
    group: "Flow",
    symbol: "IF",
    description:
      "Routes an impulse through True or False.",
    inputs: [
      port("call", "Call", "impulse"),
      port("condition", "Condition", "bool")
    ],
    outputs: [
      port("true", "True", "impulse"),
      port("false", "False", "impulse")
    ],
    codegenAction(api) {
      const yes = api.emit("true");
      const no = api.emit("false");
      return `if (${api.input("condition").code})\n        {\n            ${yes ? `${yes}();` : "// No True path."}\n        }\n        else\n        {\n            ${no ? `${no}();` : "// No False path."}\n        }`;
    }
  });

  registerNode("flow.gate", {
    title: "Gate",
    group: "Flow",
    symbol: "GATE",
    description:
      "Passes the impulse only while Open is true.",
    inputs: [
      port("call", "Call", "impulse"),
      port("open", "Open", "bool")
    ],
    outputs: [port("passed", "Passed", "impulse")],
    codegenAction(api) {
      const next = api.emit("passed");
      return next
        ? `if (${api.input("open").code})\n        {\n            ${next}();\n        }`
        : "";
    }
  });

  registerNode("flow.once", {
    title: "Once",
    group: "Flow",
    symbol: "1×",
    description:
      "Passes only the first impulse until Reset is called.",
    inputs: [
      port("call", "Call", "impulse"),
      port("reset", "Reset", "impulse")
    ],
    outputs: [port("passed", "Passed", "impulse")],
    codegenCollect(api) {
      addStatefulField(
        api,
        "once",
        "bool",
        "false"
      );
    },
    codegenAction(api) {
      const field = `_${"once"}${nodeToken(api)}`;
      if (api.connection.toPort === "reset") {
        return `${field} = false;`;
      }
      const next = api.emit("passed");
      return `if (!${field})\n        {\n            ${field} = true;${next ? `\n            ${next}();` : ""}\n        }`;
    }
  });

  registerNode("flow.counter", {
    title: "Call Counter",
    group: "Flow",
    symbol: "#",
    description:
      "Increments on Call, resets on Reset and exposes the current count.",
    inputs: [
      port("call", "Call", "impulse"),
      port("reset", "Reset", "impulse")
    ],
    outputs: [
      port("changed", "Changed", "impulse"),
      port("count", "Count", "int")
    ],
    codegenCollect(api) {
      addStatefulField(
        api,
        "counter",
        "int",
        "0"
      );
    },
    codegenExpression(api) {
      return `_counter${nodeToken(api)}`;
    },
    codegenAction(api) {
      const field = `_counter${nodeToken(api)}`;
      const next = api.emit("changed");
      const operation =
        api.connection.toPort === "reset"
          ? `${field} = 0;`
          : `${field}++;`;
      return `${operation}${next ? `\n        ${next}();` : ""}`;
    }
  });

  registerNode("flow.forLoop", {
    title: "For Loop",
    group: "Flow",
    symbol: "FOR",
    description:
      "Runs Body Count times without requiring a graph cycle.",
    inputs: [
      port("call", "Call", "impulse"),
      port("count", "Count", "int")
    ],
    outputs: [
      port("body", "Body", "impulse"),
      port("completed", "Completed", "impulse"),
      port("index", "Index", "int")
    ],
    codegenCollect(api) {
      addStatefulField(
        api,
        "loopIndex",
        "int",
        "0"
      );
    },
    codegenExpression(api) {
      return `_loopIndex${nodeToken(api)}`;
    },
    codegenAction(api) {
      const field = `_loopIndex${nodeToken(api)}`;
      const body = api.emit("body");
      const done = api.emit("completed");
      return `for (${field} = 0; ${field} < Math.Max(0, ${api.input("count").code}); ${field}++)\n        {\n            ${body ? `${body}();` : "// No Body path."}\n        }${done ? `\n        ${done}();` : ""}`;
    }
  });

  registerNode("debug.log", {
    title: "Log Message",
    group: "Debug & Output",
    symbol: "LOG",
    description:
      "Writes a formatted value through the generated mod's Msg logger.",
    inputs: [
      port("call", "Call", "impulse"),
      port("value", "Value", "object")
    ],
    outputs: [port("done", "Done", "impulse")],
    codegenAction(api) {
      const next = api.emit("done");
      return `_display(FormatValue(${api.input("value").code}));${next ? `\n        ${next}();` : ""}`;
    }
  });

  registerNode("debug.throw", {
    title: "Throw Exception",
    group: "Debug & Output",
    symbol: "!",
    description:
      "Throws an InvalidOperationException with the supplied message.",
    inputs: [
      port("call", "Call", "impulse"),
      port("message", "Message", "string")
    ],
    codegenAction(api) {
      return `throw new InvalidOperationException(${api.input("message").code});`;
    }
  });

  registerNode("lifecycle.processExit", {
    title: "On Process Exit",
    group: "Lifecycle",
    symbol: "EXIT",
    description:
      "Fires when the .NET process is shutting down.",
    outputs: [port("event", "Event", "impulse")],
    codegenCollect(api) {
      const emit = api.emitMethod(
        api.node.id,
        "event"
      );
      if (!emit) return;
      api.addInitialize(
        `AppDomain.CurrentDomain.ProcessExit += (_, _) => ${emit}();`
      );
    }
  });

  registerNode("lifecycle.unhandledException", {
    title: "On Unhandled Exception",
    group: "Lifecycle",
    symbol: "EX!",
    description:
      "Fires for AppDomain unhandled exceptions and exposes the exception object.",
    outputs: [
      port("event", "Event", "impulse"),
      port("exception", "Exception", "exception")
    ],
    codegenCollect(api) {
      const token = nodeToken(api);
      const field = `_unhandled${token}`;
      const emit = api.emitMethod(
        api.node.id,
        "event"
      );
      api.addField(
        `${api.node.id}.exception`,
        `private static Exception ${field} = null!;`
      );
      if (emit) {
        api.addInitialize(
          `AppDomain.CurrentDomain.UnhandledException += (_, args) =>\n        {\n            ${field} = args.ExceptionObject as Exception ?? new Exception(FormatValue(args.ExceptionObject));\n            ${emit}();\n        };`
        );
      }
    },
    codegenExpression(api) {
      return `_unhandled${nodeToken(api)}`;
    }
  });

  registerNode("lifecycle.subscribeEvent", {
    title: "Subscribe .NET / Resonite Event",
    group: "Lifecycle",
    symbol: "+EV",
    description:
      "Subscribes to any reflected .NET event on Engine, World, Slot, Component or another object.",
    inputs: [
      port("target", "Target", "object"),
      port("eventName", "Event name", "string")
    ],
    outputs: [
      port("event", "Event", "impulse"),
      port("arguments", "Arguments", "objectArray")
    ],
    codegenCollect(api) {
      ensureEventRuntime(api);
      const token = nodeToken(api);
      const field = `_eventArguments${token}`;
      const callback = `ReceiveEvent${token}`;
      const emit = api.emitMethod(
        api.node.id,
        "event"
      );
      api.addField(
        `${api.node.id}.args`,
        `private static object?[] ${field} = Array.Empty<object?>();`
      );
      api.addMember(
        `${api.node.id}.callback`,
        `private static void ${callback}(object?[] arguments)\n{\n    ${field} = arguments;${emit ? `\n    ${emit}();` : ""}\n}`
      );
      api.addEngineInit(
        `SubscribeGraphEvent(${api.input("target").code}, ${api.input("eventName").code}, ${callback});`
      );
    },
    codegenExpression(api) {
      return `_eventArguments${nodeToken(api)}`;
    }
  });

  registerNode("lifecycle.timer", {
    title: "Periodic Timer",
    group: "Lifecycle",
    symbol: "TMR",
    description:
      "Starts and stops a System.Threading.Timer and emits Tick at the requested interval.",
    inputs: [
      port("start", "Start", "impulse"),
      port("stop", "Stop", "impulse"),
      port("interval", "Interval ms", "int")
    ],
    outputs: [port("tick", "Tick", "impulse")],
    codegenCollect(api) {
      api.addUsing("System.Threading");
      const token = nodeToken(api);
      const field = `_timer${token}`;
      const emit = api.emitMethod(
        api.node.id,
        "tick"
      );
      api.addField(
        `${api.node.id}.timer`,
        `private static Timer? ${field};`
      );
      api.addMember(
        `${api.node.id}.startTimer`,
        `private static void StartTimer${token}(int interval)\n{\n    int safeInterval = Math.Max(1, interval);\n    ${field}?.Dispose();\n    ${field} = new Timer(_ => ${emit ? `${emit}()` : "{ }"}, null, safeInterval, safeInterval);\n}`
      );
    },
    codegenAction(api) {
      const token = nodeToken(api);
      if (api.connection.toPort === "stop") {
        return `_timer${token}?.Dispose();\n        _timer${token} = null;`;
      }
      return `StartTimer${token}(${api.input("interval").code});`;
    }
  });

  registerNode("harmony.patchEvent", {
    title: "Harmony Patch Event",
    group: "Harmony",
    symbol: "H",
    description:
      "Registers a runtime Prefix, Postfix or Finalizer and exposes its call as an impulse. Exact typed signatures, transpilers and complex result mutation remain available through Harmony Exact Patch Source.",
    parameters: [
      pSelect(
        "patchKind",
        "Patch kind",
        ["prefix", "postfix", "finalizer"],
        "prefix"
      ),
      pText(
        "targetType",
        "Target type",
        "FrooxEngine.Engine",
        "Full or assembly-qualified type name."
      ),
      pText(
        "targetMethod",
        "Target method",
        "OnReady",
        "Use .ctor or .cctor for constructors."
      ),
      pText(
        "argumentTypes",
        "Argument types",
        "",
        "Optional comma-separated full type names used to select an overload."
      ),
      pNumber(
        "priority",
        "Harmony priority",
        400,
        "Harmony Priority.Normal is 400."
      ),
      pBool(
        "captureResult",
        "Capture / replace __result",
        false,
        "Uses ref object __result. For value-type or unusual signatures use Harmony Exact Patch Source instead."
      )
    ],
    outputs: [
      port("called", "Called", "impulse"),
      port("context", "Context", "patchContext")
    ],
    codegenCollect(api) {
      ensureHarmonyRuntime(api);
      const token = nodeToken(api);
      const field = `_patchContext${token}`;
      const callback = `HarmonyCallback${token}`;
      const emit = api.emitMethod(
        api.node.id,
        "called"
      );
      const kind = String(
        api.node.parameters.patchKind ||
          "prefix"
      ).toLowerCase();
      const captureResult =
        api.node.parameters.captureResult ===
        true;
      const resultParameter = captureResult
        ? ", ref object? __result"
        : "";
      const resultInitializer = captureResult
        ? ",\n        Result = __result"
        : "";
      const resultCommit = captureResult
        ? `\n    __result = ${field}.Result;`
        : "";

      api.addField(
        `${api.node.id}.context`,
        `private static PatchContext ${field} = new();`
      );

      let callbackCode;

      if (kind === "finalizer") {
        callbackCode = `private static Exception? ${callback}(\n    object? __instance,\n    object?[] __args,\n    MethodBase __originalMethod,\n    Exception? __exception${resultParameter})\n{\n    ${field} = new PatchContext\n    {\n        Instance = __instance,\n        Arguments = __args,\n        OriginalMethod = __originalMethod,\n        Exception = __exception${resultInitializer}\n    };${emit ? `\n    ${emit}();` : ""}${resultCommit}\n    return ${field}.Exception;\n}`;
      } else if (kind === "postfix") {
        callbackCode = `private static void ${callback}(\n    object? __instance,\n    object?[] __args,\n    MethodBase __originalMethod${resultParameter})\n{\n    ${field} = new PatchContext\n    {\n        Instance = __instance,\n        Arguments = __args,\n        OriginalMethod = __originalMethod${resultInitializer}\n    };${emit ? `\n    ${emit}();` : ""}${resultCommit}\n}`;
      } else {
        callbackCode = `private static bool ${callback}(\n    object? __instance,\n    object?[] __args,\n    MethodBase __originalMethod${resultParameter})\n{\n    ${field} = new PatchContext\n    {\n        Instance = __instance,\n        Arguments = __args,\n        OriginalMethod = __originalMethod${resultInitializer}\n    };${emit ? `\n    ${emit}();` : ""}${resultCommit}\n    return !${field}.SkipOriginal;\n}`;
      }

      api.addMember(
        `${api.node.id}.callback`,
        callbackCode
      );
      api.addEngineInit(
        `RegisterGeneratedHarmonyPatch(${quote(
          api,
          api.node.parameters.targetType
        )}, ${quote(
          api,
          api.node.parameters.targetMethod
        )}, ${quote(
          api,
          api.node.parameters.argumentTypes
        )}, ${quote(api, kind)}, nameof(${callback}), ${Math.trunc(
          Number(api.node.parameters.priority) ||
            400
        )});`
      );

      if (captureResult) {
        api.warning(
          `${api.definition.title}: generic ref object __result is convenient but not valid for every value-type signature. Use Harmony Exact Patch Source for a fully exact method signature.`
        );
      }
    },
    codegenExpression(api) {
      return `_patchContext${nodeToken(api)}`;
    }
  });

  function registerLifecycleHarmonyPreset(
    id,
    title,
    symbol,
    targetType,
    targetMethod,
    description
  ) {
    const harmonyDefinition =
      registry.getNodeDefinition(
        "harmony.patchEvent"
      );

    registerNode(id, {
      title,
      group: "Lifecycle",
      symbol,
      description:
        `${description} The target type and method remain editable because internal Resonite names can change between builds.`,
      parameters: [
        pSelect(
          "patchKind",
          "Patch kind",
          ["prefix", "postfix", "finalizer"],
          "postfix"
        ),
        pText(
          "targetType",
          "Target type",
          targetType,
          "Editable full or assembly-qualified type name."
        ),
        pText(
          "targetMethod",
          "Target method",
          targetMethod,
          "Editable target method. Use the exact name from the current Resonite assemblies."
        ),
        pText(
          "argumentTypes",
          "Argument types",
          "",
          "Optional comma-separated type names for overload selection."
        ),
        pNumber(
          "priority",
          "Harmony priority",
          400
        ),
        pBool(
          "captureResult",
          "Capture / replace __result",
          false
        )
      ],
      outputs: [
        port("called", "Called", "impulse"),
        port("context", "Context", "patchContext")
      ],
      codegenCollect:
        harmonyDefinition.codegenCollect,
      codegenExpression:
        harmonyDefinition.codegenExpression
    });
  }

  registerLifecycleHarmonyPreset(
    "lifecycle.worldStart",
    "On World Start",
    "WORLD+",
    "FrooxEngine.World",
    "OnStart",
    "Editable Harmony preset for a world-start callback."
  );
  registerLifecycleHarmonyPreset(
    "lifecycle.worldDestroy",
    "On World Destroy",
    "WORLD−",
    "FrooxEngine.World",
    "OnDestroy",
    "Editable Harmony preset for world shutdown/destruction."
  );
  registerLifecycleHarmonyPreset(
    "lifecycle.userJoin",
    "On User Join",
    "USER+",
    "FrooxEngine.World",
    "OnUserJoined",
    "Editable Harmony preset for a user joining a world."
  );
  registerLifecycleHarmonyPreset(
    "lifecycle.userLeave",
    "On User Leave",
    "USER−",
    "FrooxEngine.World",
    "OnUserLeft",
    "Editable Harmony preset for a user leaving a world."
  );
  registerLifecycleHarmonyPreset(
    "lifecycle.componentAttach",
    "On Component Attach",
    "ATTACH",
    "FrooxEngine.Component",
    "OnAttach",
    "Editable Harmony preset for Component.OnAttach."
  );
  registerLifecycleHarmonyPreset(
    "lifecycle.componentDestroy",
    "On Component Destroy",
    "DEST",
    "FrooxEngine.Component",
    "OnDestroy",
    "Editable Harmony preset for a component destruction callback."
  );
  registerLifecycleHarmonyPreset(
    "lifecycle.engineUpdate",
    "On Engine Update",
    "UPDATE",
    "FrooxEngine.Engine",
    "Update",
    "Editable Harmony preset for an engine update callback."
  );

  registerNode("harmony.patchArgument", {
    title: "Patch Argument",
    group: "Harmony",
    symbol: "ARG",
    description:
      "Reads one argument from a Harmony Patch Context and converts it to the selected type.",
    configurableTypeVar: "T",
    configurableTypes: COMMON_VALUE_TYPES.filter(
      type =>
        ![
          "patchContext",
          "task",
          "cancellationToken"
        ].includes(type)
    ),
    defaultType: "object",
    parameters: [
      pNumber(
        "index",
        "Argument index",
        0
      )
    ],
    inputs: [
      port("context", "Context", "patchContext")
    ],
    outputs: [
      genericPort(
        "value",
        "Value",
        "T",
        "anyValue"
      )
    ],
    codegenExpression(api) {
      ensureReflectionRuntime(api);
      const index = Math.max(
        0,
        Math.trunc(
          Number(api.node.parameters.index) || 0
        )
      );
      return `ConvertGraphValue<${api.csType(
        api.node.parameters.valueType
      )}>(${api.input("context").code}.Arguments.Length > ${index} ? ${api.input("context").code}.Arguments[${index}] : null)`;
    }
  });

  registerNode("harmony.patchResult", {
    title: "Patch Result",
    group: "Harmony",
    symbol: "RET",
    description:
      "Reads the captured Harmony result and converts it to the selected type.",
    configurableTypeVar: "T",
    configurableTypes: COMMON_VALUE_TYPES.filter(
      type =>
        ![
          "patchContext",
          "task",
          "cancellationToken"
        ].includes(type)
    ),
    defaultType: "object",
    inputs: [port("context", "Context", "patchContext")],
    outputs: [
      genericPort(
        "value",
        "Result",
        "T",
        "anyValue"
      )
    ],
    codegenExpression(api) {
      ensureReflectionRuntime(api);
      return `ConvertGraphValue<${api.csType(
        api.node.parameters.valueType
      )}>(${api.input("context").code}.Result)`;
    }
  });

  registerNode("harmony.patchException", {
    title: "Patch Exception",
    group: "Harmony",
    symbol: "EX",
    description:
      "Reads the exception visible to a Harmony Finalizer.",
    inputs: [port("context", "Context", "patchContext")],
    outputs: [port("exception", "Exception", "exception")],
    codegenExpression(api) {
      return `${api.input("context").code}.Exception!`;
    }
  });

  registerNode("harmony.setArgument", {
    title: "Set Patch Argument",
    group: "Harmony",
    symbol: "ARG=",
    description:
      "Replaces an entry in __args. Harmony copies supported argument changes back to the original call.",
    parameters: [
      pNumber(
        "index",
        "Argument index",
        0
      )
    ],
    inputs: [
      port("call", "Call", "impulse"),
      port("context", "Context", "patchContext"),
      port("value", "Value", "object")
    ],
    outputs: [port("done", "Done", "impulse")],
    codegenAction(api) {
      const index = Math.max(
        0,
        Math.trunc(
          Number(api.node.parameters.index) || 0
        )
      );
      const context = api.input("context").code;
      const done = api.emit("done");
      return `if (${context}.Arguments.Length > ${index})\n        {\n            ${context}.Arguments[${index}] = ${api.input("value").code};\n        }${done ? `\n        ${done}();` : ""}`;
    }
  });

  registerNode("harmony.setResult", {
    title: "Set Patch Result",
    group: "Harmony",
    symbol: "RET=",
    description:
      "Updates Patch Context.Result. The Patch Event must have Capture / replace __result enabled.",
    inputs: [
      port("call", "Call", "impulse"),
      port("context", "Context", "patchContext"),
      port("value", "Value", "object")
    ],
    outputs: [port("done", "Done", "impulse")],
    codegenAction(api) {
      const done = api.emit("done");
      return `${api.input("context").code}.Result = ${api.input("value").code};${done ? `\n        ${done}();` : ""}`;
    }
  });

  registerNode("harmony.skipOriginal", {
    title: "Skip Original",
    group: "Harmony",
    symbol: "SKIP",
    description:
      "Marks a Prefix Patch Context so the generated prefix returns false.",
    inputs: [
      port("call", "Call", "impulse"),
      port("context", "Context", "patchContext")
    ],
    outputs: [port("done", "Done", "impulse")],
    codegenAction(api) {
      const done = api.emit("done");
      return `${api.input("context").code}.SkipOriginal = true;${done ? `\n        ${done}();` : ""}`;
    }
  });

  registerNode("harmony.setFinalizerException", {
    title: "Set Finalizer Exception",
    group: "Harmony",
    symbol: "EX=",
    description:
      "Replaces or clears the exception returned by a generated Harmony Finalizer.",
    inputs: [
      port("call", "Call", "impulse"),
      port("context", "Context", "patchContext"),
      port("exception", "Exception", "exception")
    ],
    outputs: [port("done", "Done", "impulse")],
    codegenAction(api) {
      const done = api.emit("done");
      return `${api.input("context").code}.Exception = ${api.input("exception").code};${done ? `\n        ${done}();` : ""}`;
    }
  });

  registerNode("harmony.reversePatch", {
    title: "Create Reverse Patch",
    group: "Harmony",
    symbol: "REV",
    description:
      "Creates a Harmony reverse patch between an existing target method and an exact stand-in method supplied in custom C# source.",
    parameters: [
      pText("targetType", "Target type", "FrooxEngine.SomeType"),
      pText("targetMethod", "Target method", "SomeMethod"),
      pText("targetArguments", "Target argument types", ""),
      pText(
        "standInType",
        "Stand-in type",
        "YourModNamespace.YourModReversePatches"
      ),
      pText(
        "standInMethod",
        "Stand-in method",
        "CallOriginal"
      )
    ],
    inputs: [port("call", "Create", "impulse")],
    outputs: [port("done", "Done", "impulse")],
    codegenCollect(api) {
      ensureHarmonyRuntime(api);
    },
    codegenAction(api) {
      const done = api.emit("done");
      return `CreateGeneratedReversePatch(${quote(
        api,
        api.node.parameters.targetType
      )}, ${quote(
        api,
        api.node.parameters.targetMethod
      )}, ${quote(
        api,
        api.node.parameters.targetArguments
      )}, ${quote(
        api,
        api.node.parameters.standInType
      )}, ${quote(
        api,
        api.node.parameters.standInMethod
      )});${done ? `\n        ${done}();` : ""}`;
    }
  });

  registerNode("harmony.unpatchAll", {
    title: "Unpatch Generated Harmony ID",
    group: "Harmony",
    symbol: "UNH",
    description:
      "Removes every patch created under this generated graph's Harmony ID.",
    inputs: [port("call", "Call", "impulse")],
    outputs: [port("done", "Done", "impulse")],
    codegenCollect(api) {
      ensureHarmonyRuntime(api);
    },
    codegenAction(api) {
      const done = api.emit("done");
      return `_graphHarmony.UnpatchAll(_graphHarmony.Id);${done ? `\n        ${done}();` : ""}`;
    }
  });

  registerNode("reflection.findType", {
    title: "Find Type",
    group: "Reflection",
    symbol: "TYPE",
    description:
      "Finds a loaded runtime type by full, assembly-qualified or short name.",
    inputs: [port("name", "Type name", "string")],
    outputs: [port("type", "Type", "type")],
    codegenExpression(api) {
      ensureReflectionRuntime(api);
      return `FindType(${api.input("name").code})!`;
    }
  });

  registerNode("reflection.getMethod", {
    title: "Get MethodInfo",
    group: "Reflection",
    symbol: "M",
    description:
      "Resolves a reflected method, optionally selecting an overload with comma-separated argument types.",
    inputs: [
      port("type", "Type", "type"),
      port("name", "Method name", "string"),
      port("argumentTypes", "Argument types", "string")
    ],
    outputs: [port("method", "Method", "methodInfo")],
    codegenExpression(api) {
      ensureReflectionRuntime(api);
      return `FindMethod(${api.input("type").code}, ${api.input("name").code}, ResolveTypeList(${api.input("argumentTypes").code}))!`;
    }
  });

  registerNode("reflection.getField", {
    title: "Get FieldInfo",
    group: "Reflection",
    symbol: "F",
    description:
      "Gets a public or non-public instance/static field.",
    inputs: [
      port("type", "Type", "type"),
      port("name", "Field name", "string")
    ],
    outputs: [port("field", "Field", "fieldInfo")],
    codegenExpression(api) {
      ensureReflectionRuntime(api);
      return `${api.input("type").code}.GetField(${api.input("name").code}, GraphAllMembers)!`;
    }
  });

  registerNode("reflection.getProperty", {
    title: "Get PropertyInfo",
    group: "Reflection",
    symbol: "P",
    description:
      "Gets a public or non-public instance/static property.",
    inputs: [
      port("type", "Type", "type"),
      port("name", "Property name", "string")
    ],
    outputs: [port("property", "Property", "propertyInfo")],
    codegenExpression(api) {
      ensureReflectionRuntime(api);
      return `${api.input("type").code}.GetProperty(${api.input("name").code}, GraphAllMembers)!`;
    }
  });

  registerNode("reflection.readMember", {
    title: "Read Member / Path",
    group: "Reflection",
    symbol: "GET",
    description:
      "Reads a field or property. Dots traverse nested members.",
    inputs: [
      port("target", "Target", "object"),
      port("path", "Member path", "string")
    ],
    outputs: [port("value", "Value", "object")],
    codegenExpression(api) {
      ensureReflectionRuntime(api);
      return `ReadMemberPath(${api.input("target").code}, ${api.input("path").code})!`;
    }
  });

  registerNode("reflection.convertObject", {
    title: "Convert Object",
    group: "Reflection",
    symbol: "CAST",
    description:
      "Converts an object to the selected graph type using reflection-aware conversion.",
    configurableTypeVar: "T",
    configurableTypes: COMMON_VALUE_TYPES.filter(
      type =>
        ![
          "patchContext",
          "task",
          "cancellationToken"
        ].includes(type)
    ),
    defaultType: "string",
    inputs: [port("value", "Object", "object")],
    outputs: [
      genericPort(
        "result",
        "Result",
        "T",
        "anyValue"
      )
    ],
    codegenExpression(api) {
      ensureReflectionRuntime(api);
      return `ConvertGraphValue<${api.csType(
        api.node.parameters.valueType
      )}>(${api.input("value").code})`;
    }
  });

  registerNode("reflection.writeMember", {
    title: "Write Member",
    group: "Reflection",
    symbol: "SET",
    description:
      "Sets a reflected field or property on an object or Type.",
    inputs: [
      port("call", "Call", "impulse"),
      port("target", "Target", "object"),
      port("name", "Member name", "string"),
      port("value", "Value", "object")
    ],
    outputs: [
      port("done", "Done", "impulse"),
      port("success", "Success", "bool")
    ],
    codegenCollect(api) {
      ensureReflectionRuntime(api);
      addStatefulField(
        api,
        "writeSuccess",
        "bool",
        "false"
      );
    },
    codegenExpression(api) {
      return `_writeSuccess${nodeToken(api)}`;
    },
    codegenAction(api) {
      const field = `_writeSuccess${nodeToken(api)}`;
      const done = api.emit("done");
      return `${field} = WriteMember(${api.input("target").code}, ${api.input("name").code}, ${api.input("value").code});${done ? `\n        ${done}();` : ""}`;
    }
  });

  registerNode("reflection.invokeMethod", {
    title: "Invoke MethodInfo",
    group: "Reflection",
    symbol: "CALL",
    description:
      "Invokes a MethodInfo with an optional target and object argument array.",
    inputs: [
      port("call", "Call", "impulse"),
      port("method", "Method", "methodInfo"),
      port("target", "Target", "object"),
      port("arguments", "Arguments", "objectArray")
    ],
    outputs: [
      port("done", "Done", "impulse"),
      port("result", "Result", "object"),
      port("exception", "Exception", "exception")
    ],
    codegenCollect(api) {
      ensureReflectionRuntime(api);
      const token = nodeToken(api);
      api.addField(
        `${api.node.id}.result`,
        `private static object? _invokeResult${token};`
      );
      api.addField(
        `${api.node.id}.error`,
        `private static Exception _invokeException${token} = null!;`
      );
    },
    codegenExpression(api) {
      const token = nodeToken(api);
      return api.portId === "exception"
        ? `_invokeException${token}`
        : `_invokeResult${token}!`;
    },
    codegenAction(api) {
      const token = nodeToken(api);
      const done = api.emit("done");
      return `try\n        {\n            _invokeException${token} = null!;\n            _invokeResult${token} = InvokeMethodInfo(${api.input("method").code}, ${api.input("target").code}, ${api.input("arguments").code});\n        }\n        catch (Exception exception)\n        {\n            _invokeException${token} = exception;\n            _invokeResult${token} = null;\n        }${done ? `\n        ${done}();` : ""}`;
    }
  });

  registerNode("reflection.callByName", {
    title: "Call Method By Name",
    group: "Reflection",
    symbol: "NAME()",
    description:
      "Invokes the best matching instance or static method by name.",
    inputs: [
      port("call", "Call", "impulse"),
      port("target", "Target / Type", "object"),
      port("name", "Method name", "string"),
      port("arguments", "Arguments", "objectArray")
    ],
    outputs: [
      port("done", "Done", "impulse"),
      port("result", "Result", "object")
    ],
    codegenCollect(api) {
      ensureReflectionRuntime(api);
      addStatefulField(
        api,
        "callResult",
        "object?",
        "null"
      );
    },
    codegenExpression(api) {
      return `_callResult${nodeToken(api)}!`;
    },
    codegenAction(api) {
      const field = `_callResult${nodeToken(api)}`;
      const done = api.emit("done");
      return `${field} = InvokeBest(${api.input("target").code}, ${api.input("name").code}, ${api.input("arguments").code});${done ? `\n        ${done}();` : ""}`;
    }
  });

  registerNode("reflection.createInstance", {
    title: "Create Instance",
    group: "Reflection",
    symbol: "NEW",
    description:
      "Constructs a reflected Type with an object argument array.",
    inputs: [
      port("call", "Call", "impulse"),
      port("type", "Type", "type"),
      port("arguments", "Arguments", "objectArray")
    ],
    outputs: [
      port("done", "Done", "impulse"),
      port("instance", "Instance", "object")
    ],
    codegenCollect(api) {
      ensureReflectionRuntime(api);
      addStatefulField(
        api,
        "createdInstance",
        "object?",
        "null"
      );
    },
    codegenExpression(api) {
      return `_createdInstance${nodeToken(api)}!`;
    },
    codegenAction(api) {
      const field = `_createdInstance${nodeToken(api)}`;
      const done = api.emit("done");
      return `${field} = CreateReflective(${api.input("type").code}, ${api.input("arguments").code});${done ? `\n        ${done}();` : ""}`;
    }
  });

  registerType("user", {
    label: "Resonite User",
    short: "USER",
    color: "#65dcb1",
    csType: "object",
    defaultCs: "null!",
    referenceType: true,
    assignableTo: ["object"]
  });

  registerNode("resonite.currentEngine", {
    title: "Current Engine",
    group: "Slots & Components",
    symbol: "ENG",
    description:
      "Reads FrooxEngine.Engine.Current through reflection.",
    outputs: [port("engine", "Engine", "engine")],
    codegenExpression(api) {
      ensureResoniteRuntime(api);
      return "CurrentEngine()!";
    }
  });

  registerNode("resonite.userspaceWorld", {
    title: "Userspace World",
    group: "Slots & Components",
    symbol: "USR",
    description:
      "Gets the current Userspace world through the Engine's WorldManager.",
    outputs: [port("world", "World", "world")],
    codegenExpression(api) {
      ensureResoniteRuntime(api);
      return "CurrentUserspaceWorld()!";
    }
  });

  registerNode("resonite.focusedWorld", {
    title: "Focused World",
    group: "Slots & Components",
    symbol: "WRLD",
    description:
      "Gets the currently focused/local world with a Userspace fallback.",
    outputs: [port("world", "World", "world")],
    codegenExpression(api) {
      ensureResoniteRuntime(api);
      return "CurrentFocusedWorld()!";
    }
  });

  registerNode("resonite.worldRootSlot", {
    title: "World Root Slot",
    group: "Slots & Components",
    symbol: "ROOT",
    description:
      "Gets RootSlot/Root from a reflected world object.",
    inputs: [port("world", "World", "world")],
    outputs: [port("slot", "Root Slot", "slot")],
    codegenExpression(api) {
      ensureResoniteRuntime(api);
      return `WorldRootSlot(${api.input("world").code})!`;
    }
  });

  registerNode("resonite.localUser", {
    title: "Local User",
    group: "Slots & Components",
    symbol: "ME",
    description:
      "Gets the local user from a world.",
    inputs: [port("world", "World", "world")],
    outputs: [port("user", "User", "user")],
    codegenExpression(api) {
      ensureResoniteRuntime(api);
      return `CurrentLocalUser(${api.input("world").code})!`;
    }
  });

  registerNode("resonite.findSlot", {
    title: "Find Slot",
    group: "Slots & Components",
    symbol: "?S",
    description:
      "Finds a child slot recursively by name/path starting at Root.",
    inputs: [
      port("root", "Root", "slot"),
      port("name", "Name / path", "string")
    ],
    outputs: [port("slot", "Slot", "slot")],
    codegenExpression(api) {
      ensureResoniteRuntime(api);
      return `FindSlotRecursive(${api.input("root").code}, ${api.input("name").code})!`;
    }
  });

  registerNode("resonite.addSlot", {
    title: "Add Slot",
    group: "Slots & Components",
    symbol: "+S",
    description:
      "Creates a child slot using AddSlot/AddChild reflection fallback.",
    inputs: [
      port("call", "Call", "impulse"),
      port("parent", "Parent", "slot"),
      port("name", "Name", "string")
    ],
    outputs: [
      port("done", "Done", "impulse"),
      port("slot", "Created Slot", "slot")
    ],
    codegenCollect(api) {
      ensureResoniteRuntime(api);
      addStatefulField(
        api,
        "createdSlot",
        "object?",
        "null"
      );
    },
    codegenExpression(api) {
      return `_createdSlot${nodeToken(api)}!`;
    },
    codegenAction(api) {
      const field = `_createdSlot${nodeToken(api)}`;
      const done = api.emit("done");
      return `${field} = AddSlotReflective(${api.input("parent").code}, ${api.input("name").code});${done ? `\n        ${done}();` : ""}`;
    }
  });

  registerNode("resonite.destroyObject", {
    title: "Destroy Slot / Component",
    group: "Slots & Components",
    symbol: "DEL",
    description:
      "Calls Destroy, DestroyPersistent or Dispose on a reflected Resonite object.",
    inputs: [
      port("call", "Call", "impulse"),
      port("target", "Target", "object")
    ],
    outputs: [
      port("done", "Done", "impulse"),
      port("success", "Success", "bool")
    ],
    codegenCollect(api) {
      ensureResoniteRuntime(api);
      addStatefulField(
        api,
        "destroySuccess",
        "bool",
        "false"
      );
    },
    codegenExpression(api) {
      return `_destroySuccess${nodeToken(api)}`;
    },
    codegenAction(api) {
      const field = `_destroySuccess${nodeToken(api)}`;
      const done = api.emit("done");
      return `${field} = DestroyReflective(${api.input("target").code});${done ? `\n        ${done}();` : ""}`;
    }
  });

  registerNode("resonite.getComponent", {
    title: "Get Component",
    group: "Slots & Components",
    symbol: "GETC",
    description:
      "Finds a component of the supplied reflected Type on a Slot.",
    inputs: [
      port("slot", "Slot", "slot"),
      port("type", "Component Type", "type")
    ],
    outputs: [port("component", "Component", "component")],
    codegenExpression(api) {
      ensureResoniteRuntime(api);
      return `FindComponentReflective(${api.input("slot").code}, ${api.input("type").code})!`;
    }
  });

  registerNode("resonite.attachComponent", {
    title: "Attach Component",
    group: "Slots & Components",
    symbol: "+C",
    description:
      "Attaches a component by Type, including generic AttachComponent<T>() fallback.",
    inputs: [
      port("call", "Call", "impulse"),
      port("slot", "Slot", "slot"),
      port("type", "Component Type", "type")
    ],
    outputs: [
      port("done", "Done", "impulse"),
      port("component", "Component", "component")
    ],
    codegenCollect(api) {
      ensureResoniteRuntime(api);
      addStatefulField(
        api,
        "attachedComponent",
        "object?",
        "null"
      );
    },
    codegenExpression(api) {
      return `_attachedComponent${nodeToken(api)}!`;
    },
    codegenAction(api) {
      const field = `_attachedComponent${nodeToken(api)}`;
      const done = api.emit("done");
      return `${field} = AttachComponentReflective(${api.input("slot").code}, ${api.input("type").code});${done ? `\n        ${done}();` : ""}`;
    }
  });

  registerNode("resonite.readMember", {
    title: "Read Slot / Component Member",
    group: "Slots & Components",
    symbol: "SYNC→",
    description:
      "Reads a normal field/property or the Value of a Sync<T>-style member path, then converts it to the selected type.",
    configurableTypeVar: "T",
    configurableTypes: COMMON_VALUE_TYPES.filter(
      type =>
        ![
          "patchContext",
          "task",
          "cancellationToken"
        ].includes(type)
    ),
    defaultType: "object",
    inputs: [
      port("target", "Target", "object"),
      port("path", "Member path", "string")
    ],
    outputs: [
      genericPort(
        "value",
        "Value",
        "T",
        "anyValue"
      )
    ],
    codegenExpression(api) {
      ensureResoniteRuntime(api);
      return `ConvertGraphValue<${api.csType(
        api.node.parameters.valueType
      )}>(ReadSyncMember(${api.input("target").code}, ${api.input("path").code}))`;
    }
  });

  registerNode("resonite.writeMember", {
    title: "Write Slot / Component Member",
    group: "Slots & Components",
    symbol: "→SYNC",
    description:
      "Writes either member.Value or the member itself through reflection.",
    inputs: [
      port("call", "Call", "impulse"),
      port("target", "Target", "object"),
      port("path", "Member path", "string"),
      port("value", "Value", "object")
    ],
    outputs: [
      port("done", "Done", "impulse"),
      port("success", "Success", "bool")
    ],
    codegenCollect(api) {
      ensureResoniteRuntime(api);
      addStatefulField(
        api,
        "syncWriteSuccess",
        "bool",
        "false"
      );
    },
    codegenExpression(api) {
      return `_syncWriteSuccess${nodeToken(api)}`;
    },
    codegenAction(api) {
      const field = `_syncWriteSuccess${nodeToken(api)}`;
      const done = api.emit("done");
      return `${field} = WriteSyncMember(${api.input("target").code}, ${api.input("path").code}, ${api.input("value").code});${done ? `\n        ${done}();` : ""}`;
    }
  });

  registerNode("resonite.dynamicVariableSpace", {
    title: "Get Dynamic Variable Space",
    group: "Slots & Components",
    symbol: "DVS",
    description:
      "Finds a real DynamicVariableSpace component on a Slot through the current Resonite assemblies.",
    inputs: [port("slot", "Slot", "slot")],
    outputs: [
      port(
        "space",
        "Dynamic Variable Space",
        "dynamicVariableSpace"
      )
    ],
    codegenExpression(api) {
      ensureResoniteRuntime(api);
      return `FindComponentReflective(${api.input("slot").code}, FindType("FrooxEngine.DynamicVariableSpace"))!`;
    }
  });

  registerNode("resonite.attachDynamicVariableSpace", {
    title: "Attach Dynamic Variable Space",
    group: "Slots & Components",
    symbol: "+DVS",
    description:
      "Attaches a real DynamicVariableSpace component by reflected type name.",
    inputs: [
      port("call", "Call", "impulse"),
      port("slot", "Slot", "slot")
    ],
    outputs: [
      port("done", "Done", "impulse"),
      port(
        "space",
        "Dynamic Variable Space",
        "dynamicVariableSpace"
      )
    ],
    codegenCollect(api) {
      ensureResoniteRuntime(api);
      addStatefulField(
        api,
        "dynamicSpace",
        "object?",
        "null"
      );
    },
    codegenExpression(api) {
      return `_dynamicSpace${nodeToken(api)}!`;
    },
    codegenAction(api) {
      const field = `_dynamicSpace${nodeToken(api)}`;
      const done = api.emit("done");
      return `${field} = AttachComponentReflective(${api.input("slot").code}, FindType("FrooxEngine.DynamicVariableSpace"));${done ? `\n        ${done}();` : ""}`;
    }
  });

  registerNode("resonite.readDynamicVariable", {
    title: "Read Dynamic Variable",
    group: "Slots & Components",
    symbol: "DYN→",
    description:
      "Reads a real dynamic variable from a DynamicVariableSpace using reflected ReadValue/GetValue fallbacks.",
    configurableTypeVar: "T",
    configurableTypes: COMMON_VALUE_TYPES.filter(
      type =>
        ![
          "patchContext",
          "task",
          "cancellationToken"
        ].includes(type)
    ),
    defaultType: "object",
    inputs: [
      port(
        "space",
        "Dynamic Variable Space",
        "dynamicVariableSpace"
      ),
      port("name", "Variable name", "string")
    ],
    outputs: [
      genericPort(
        "value",
        "Value",
        "T",
        "anyValue"
      )
    ],
    codegenExpression(api) {
      ensureResoniteRuntime(api);
      return `ConvertGraphValue<${api.csType(
        api.node.parameters.valueType
      )}>(ReadDynamicVariableReflective(${api.input("space").code}, ${api.input("name").code}))`;
    }
  });

  registerNode("resonite.writeDynamicVariable", {
    title: "Write Dynamic Variable",
    group: "Slots & Components",
    symbol: "→DYN",
    description:
      "Writes a real dynamic variable through WriteValue/SetValue reflection fallbacks.",
    inputs: [
      port("call", "Call", "impulse"),
      port(
        "space",
        "Dynamic Variable Space",
        "dynamicVariableSpace"
      ),
      port("name", "Variable name", "string"),
      port("value", "Value", "object")
    ],
    outputs: [
      port("done", "Done", "impulse"),
      port("success", "Success", "bool")
    ],
    codegenCollect(api) {
      ensureResoniteRuntime(api);
      addStatefulField(
        api,
        "dynamicWriteSuccess",
        "bool",
        "false"
      );
    },
    codegenExpression(api) {
      return `_dynamicWriteSuccess${nodeToken(api)}`;
    },
    codegenAction(api) {
      const field = `_dynamicWriteSuccess${nodeToken(api)}`;
      const done = api.emit("done");
      return `${field} = WriteDynamicVariableReflective(${api.input("space").code}, ${api.input("name").code}, ${api.input("value").code});${done ? `\n        ${done}();` : ""}`;
    }
  });

  registerNode("resonite.radiantDash", {
    title: "Current Radiant Dash",
    group: "Slots & Components",
    symbol: "DASH",
    description:
      "Finds the current Userspace RadiantDash through member paths and component fallback.",
    outputs: [
      port("dash", "Radiant Dash", "radiantDash")
    ],
    codegenExpression(api) {
      ensureResoniteRuntime(api);
      return "CurrentRadiantDash()!";
    }
  });

  registerNode("resonite.setRadiantDashOpen", {
    title: "Set Radiant Dash Open",
    group: "Slots & Components",
    symbol: "DASH=",
    description:
      "Sets the reflected RadiantDash.Open member.",
    inputs: [
      port("call", "Call", "impulse"),
      port("dash", "Radiant Dash", "radiantDash"),
      port("open", "Open", "bool")
    ],
    outputs: [
      port("done", "Done", "impulse"),
      port("success", "Success", "bool")
    ],
    codegenCollect(api) {
      ensureResoniteRuntime(api);
      addStatefulField(
        api,
        "dashOpenSuccess",
        "bool",
        "false"
      );
    },
    codegenExpression(api) {
      return `_dashOpenSuccess${nodeToken(api)}`;
    },
    codegenAction(api) {
      const field = `_dashOpenSuccess${nodeToken(api)}`;
      const done = api.emit("done");
      return `${field} = WriteMember(${api.input("dash").code}, "Open", ${api.input("open").code});${done ? `\n        ${done}();` : ""}`;
    }
  });

  registerNode("resonite.openModalOverlay", {
    title: "Open Radiant Dash Modal",
    group: "UI",
    symbol: "MODAL",
    description:
      "Calls OpenModalOverlay on RadiantDash.Slot or the dash itself and returns the created modal root.",
    inputs: [
      port("call", "Call", "impulse"),
      port("dash", "Radiant Dash", "radiantDash"),
      port("size", "Size", "float2"),
      port("title", "Title", "string")
    ],
    outputs: [
      port("done", "Done", "impulse"),
      port("root", "Modal root", "slot")
    ],
    codegenCollect(api) {
      ensureResoniteRuntime(api);
      addStatefulField(
        api,
        "modalRoot",
        "object?",
        "null"
      );
    },
    codegenExpression(api) {
      return `_modalRoot${nodeToken(api)}!`;
    },
    codegenAction(api) {
      const field = `_modalRoot${nodeToken(api)}`;
      const done = api.emit("done");
      return `${field} = OpenRadiantDashModalReflective(${api.input("dash").code}, ${api.input("size").code}, ${api.input("title").code});${done ? `\n        ${done}();` : ""}`;
    }
  });

  registerNode("ui.createBuilder", {
    title: "Create UIBuilder",
    group: "UI",
    symbol: "UIB",
    description:
      "Constructs FrooxEngine.UIX.UIBuilder for a target Slot through reflection.",
    inputs: [port("slot", "Slot", "slot")],
    outputs: [port("builder", "UIBuilder", "uiBuilder")],
    codegenExpression(api) {
      ensureResoniteRuntime(api);
      return `CreateUiBuilderReflective(${api.input("slot").code})!`;
    }
  });

  function registerUiElementNode(
    id,
    title,
    symbol,
    methodName,
    inputPorts,
    argumentIds,
    description
  ) {
    registerNode(id, {
      title,
      group: "UI",
      symbol,
      description,
      inputs: [
        port("call", "Call", "impulse"),
        port("builder", "UIBuilder", "uiBuilder"),
        ...inputPorts
      ],
      outputs: [
        port("done", "Done", "impulse"),
        port("element", "Element", "uiElement")
      ],
      codegenCollect(api) {
        ensureResoniteRuntime(api);
        addStatefulField(
          api,
          "uiElement",
          "object?",
          "null"
        );
      },
      codegenExpression(api) {
        return `_uiElement${nodeToken(api)}!`;
      },
      codegenAction(api) {
        const field = `_uiElement${nodeToken(api)}`;
        const done = api.emit("done");
        const args = argumentIds
          .map(argument =>
            api.input(argument).code
          )
          .join(", ");
        return `${field} = CreateUiElementReflective(${api.input("builder").code}, ${quote(api, methodName)}${args ? `, ${args}` : ""});${done ? `\n        ${done}();` : ""}`;
      }
    });
  }

  registerUiElementNode(
    "ui.panel",
    "UI Panel",
    "PNL",
    "Panel",
    [],
    [],
    "Creates a panel/container with UIBuilder.Panel()."
  );
  registerUiElementNode(
    "ui.text",
    "UI Text",
    "TXT",
    "Text",
    [port("text", "Text", "string")],
    ["text"],
    "Creates a text element through UIBuilder.Text()."
  );
  registerUiElementNode(
    "ui.button",
    "UI Button",
    "BTN",
    "Button",
    [port("text", "Text", "string")],
    ["text"],
    "Creates a button. Subscribe to its reflected event/member to react to presses."
  );
  registerUiElementNode(
    "ui.slider",
    "UI Slider",
    "SLD",
    "Slider",
    [
      port("minimum", "Minimum", "float"),
      port("maximum", "Maximum", "float"),
      port("value", "Value", "float")
    ],
    ["minimum", "maximum", "value"],
    "Creates a slider using the best matching UIBuilder.Slider overload."
  );
  registerUiElementNode(
    "ui.checkbox",
    "UI Checkbox",
    "CHK",
    "Checkbox",
    [port("value", "Value", "bool")],
    ["value"],
    "Creates a checkbox using the best matching UIBuilder.Checkbox overload."
  );
  registerUiElementNode(
    "ui.image",
    "UI Image",
    "IMG",
    "Image",
    [port("source", "Source", "object")],
    ["source"],
    "Creates an image using the best matching UIBuilder.Image overload."
  );

  registerNode("ui.callBuilderMethod", {
    title: "Call UIBuilder Method",
    group: "UI",
    symbol: "UI()",
    description:
      "Universal UIBuilder escape hatch for methods not covered by a dedicated node.",
    inputs: [
      port("call", "Call", "impulse"),
      port("builder", "UIBuilder", "uiBuilder"),
      port("method", "Method", "string"),
      port("arguments", "Arguments", "objectArray")
    ],
    outputs: [
      port("done", "Done", "impulse"),
      port("element", "Result", "uiElement")
    ],
    codegenCollect(api) {
      ensureResoniteRuntime(api);
      addStatefulField(
        api,
        "uiCallResult",
        "object?",
        "null"
      );
    },
    codegenExpression(api) {
      return `_uiCallResult${nodeToken(api)}!`;
    },
    codegenAction(api) {
      const field = `_uiCallResult${nodeToken(api)}`;
      const done = api.emit("done");
      return `${field} = InvokeBest(${api.input("builder").code}, ${api.input("method").code}, ${api.input("arguments").code});${done ? `\n        ${done}();` : ""}`;
    }
  });

  registerNode("ui.setMember", {
    title: "Set UI Member",
    group: "UI",
    symbol: "UI=",
    description:
      "Sets any UI element/component field, property or Sync<T> path.",
    inputs: [
      port("call", "Call", "impulse"),
      port("element", "Element", "uiElement"),
      port("path", "Member path", "string"),
      port("value", "Value", "object")
    ],
    outputs: [port("done", "Done", "impulse")],
    codegenCollect(api) {
      ensureResoniteRuntime(api);
    },
    codegenAction(api) {
      const done = api.emit("done");
      return `WriteSyncMember(${api.input("element").code}, ${api.input("path").code}, ${api.input("value").code});${done ? `\n        ${done}();` : ""}`;
    }
  });

  registerNode("asset.manager", {
    title: "Get Engine Asset Manager",
    group: "Assets",
    symbol: "AM",
    description:
      "Reads an Engine member path such as AssetManager, LocalDB or WorldManager.",
    parameters: [
      pText(
        "memberPath",
        "Engine member path",
        "AssetManager"
      )
    ],
    outputs: [port("manager", "Manager", "object")],
    codegenExpression(api) {
      ensureResoniteRuntime(api);
      return `ReadMemberPath(CurrentEngine(), ${quote(api, api.node.parameters.memberPath)})!`;
    }
  });

  registerNode("asset.request", {
    title: "Request / Load Asset",
    group: "Assets",
    symbol: "LOAD",
    description:
      "Invokes an asset manager method with URI and optional arguments. Use Method name to match the current Resonite API.",
    parameters: [
      pText(
        "methodName",
        "Manager method",
        "RequestAsset"
      )
    ],
    inputs: [
      port("call", "Call", "impulse"),
      port("manager", "Manager", "object"),
      port("uri", "URI", "Uri"),
      port("arguments", "Extra arguments", "objectArray")
    ],
    outputs: [
      port("done", "Done", "impulse"),
      port("asset", "Asset / request", "asset")
    ],
    codegenCollect(api) {
      ensureResoniteRuntime(api);
      addStatefulField(
        api,
        "assetResult",
        "object?",
        "null"
      );
    },
    codegenExpression(api) {
      return `_assetResult${nodeToken(api)}!`;
    },
    codegenAction(api) {
      const field = `_assetResult${nodeToken(api)}`;
      const done = api.emit("done");
      return `${field} = InvokeBest(${api.input("manager").code}, ${quote(api, api.node.parameters.methodName)}, new object?[] { ${api.input("uri").code} }.Concat(${api.input("arguments").code}).ToArray());${done ? `\n        ${done}();` : ""}`;
    }
  });

  registerNode("file.combinePath", {
    title: "Combine Path",
    group: "Files & JSON",
    symbol: "PATH",
    description:
      "Combines up to four filesystem path segments.",
    inputs: [
      port("a", "A", "string"),
      port("b", "B", "string"),
      port("c", "C", "string"),
      port("d", "D", "string")
    ],
    outputs: [port("path", "Path", "string")],
    codegenCollect(api) {
      api.addUsing("System.IO");
    },
    codegenExpression(api) {
      return `Path.Combine(${api.input("a").code}, ${api.input("b").code}, ${api.input("c").code}, ${api.input("d").code})`;
    }
  });

  registerNode("file.fileExists", {
    title: "File Exists",
    group: "Files & JSON",
    symbol: "F?",
    description: "Checks File.Exists(path).",
    inputs: [port("path", "Path", "string")],
    outputs: [port("exists", "Exists", "bool")],
    codegenCollect(api) {
      api.addUsing("System.IO");
    },
    codegenExpression(api) {
      return `File.Exists(${api.input("path").code})`;
    }
  });

  registerNode("file.directoryExists", {
    title: "Directory Exists",
    group: "Files & JSON",
    symbol: "D?",
    description: "Checks Directory.Exists(path).",
    inputs: [port("path", "Path", "string")],
    outputs: [port("exists", "Exists", "bool")],
    codegenCollect(api) {
      api.addUsing("System.IO");
    },
    codegenExpression(api) {
      return `Directory.Exists(${api.input("path").code})`;
    }
  });

  registerNode("file.readText", {
    title: "Read Text File",
    group: "Files & JSON",
    symbol: "READ",
    description:
      "Reads UTF-8 text and exposes any exception without crashing the graph path.",
    inputs: [
      port("call", "Call", "impulse"),
      port("path", "Path", "string")
    ],
    outputs: [
      port("done", "Done", "impulse"),
      port("text", "Text", "string"),
      port("exception", "Exception", "exception")
    ],
    codegenCollect(api) {
      api.addUsing("System.IO");
      const token = nodeToken(api);
      api.addField(
        `${api.node.id}.text`,
        `private static string _readText${token} = string.Empty;`
      );
      api.addField(
        `${api.node.id}.exception`,
        `private static Exception _readTextException${token} = null!;`
      );
    },
    codegenExpression(api) {
      const token = nodeToken(api);
      return api.portId === "exception"
        ? `_readTextException${token}`
        : `_readText${token}`;
    },
    codegenAction(api) {
      const token = nodeToken(api);
      const done = api.emit("done");
      return `try\n        {\n            _readTextException${token} = null!;\n            _readText${token} = File.ReadAllText(${api.input("path").code});\n        }\n        catch (Exception exception)\n        {\n            _readTextException${token} = exception;\n            _readText${token} = string.Empty;\n        }${done ? `\n        ${done}();` : ""}`;
    }
  });

  registerNode("file.readBytes", {
    title: "Read Binary File",
    group: "Files & JSON",
    symbol: "BIN←",
    description: "Reads all bytes from a file.",
    inputs: [
      port("call", "Call", "impulse"),
      port("path", "Path", "string")
    ],
    outputs: [
      port("done", "Done", "impulse"),
      port("bytes", "Bytes", "byteArray")
    ],
    codegenCollect(api) {
      api.addUsing("System.IO");
      addStatefulField(
        api,
        "readBytes",
        "byte[]",
        "Array.Empty<byte>()"
      );
    },
    codegenExpression(api) {
      return `_readBytes${nodeToken(api)}`;
    },
    codegenAction(api) {
      const field = `_readBytes${nodeToken(api)}`;
      const done = api.emit("done");
      return `${field} = File.ReadAllBytes(${api.input("path").code});${done ? `\n        ${done}();` : ""}`;
    }
  });

  function registerFileWriteNode(
    id,
    title,
    symbol,
    method,
    valueType,
    description
  ) {
    registerNode(id, {
      title,
      group: "Files & JSON",
      symbol,
      description,
      inputs: [
        port("call", "Call", "impulse"),
        port("path", "Path", "string"),
        port("value", "Value", valueType)
      ],
      outputs: [
        port("done", "Done", "impulse"),
        port("exception", "Exception", "exception")
      ],
      codegenCollect(api) {
        api.addUsing("System.IO");
        api.addField(
          `${api.node.id}.exception`,
          `private static Exception _fileWriteException${nodeToken(api)} = null!;`
        );
      },
      codegenExpression(api) {
        return `_fileWriteException${nodeToken(api)}`;
      },
      codegenAction(api) {
        const token = nodeToken(api);
        const done = api.emit("done");
        return `try\n        {\n            _fileWriteException${token} = null!;\n            ${method}(${api.input("path").code}, ${api.input("value").code});\n        }\n        catch (Exception exception)\n        {\n            _fileWriteException${token} = exception;\n        }${done ? `\n        ${done}();` : ""}`;
      }
    });
  }

  registerFileWriteNode(
    "file.writeText",
    "Write Text File",
    "WRITE",
    "File.WriteAllText",
    "string",
    "Overwrites a UTF-8 text file."
  );
  registerFileWriteNode(
    "file.appendText",
    "Append Text File",
    "APPEND",
    "File.AppendAllText",
    "string",
    "Appends UTF-8 text to a file."
  );
  registerFileWriteNode(
    "file.writeBytes",
    "Write Binary File",
    "BIN→",
    "File.WriteAllBytes",
    "byteArray",
    "Writes a complete byte array to a file."
  );

  registerNode("file.createDirectory", {
    title: "Create Directory",
    group: "Files & JSON",
    symbol: "+DIR",
    description:
      "Creates the directory and all missing parents.",
    inputs: [
      port("call", "Call", "impulse"),
      port("path", "Path", "string")
    ],
    outputs: [port("done", "Done", "impulse")],
    codegenCollect(api) {
      api.addUsing("System.IO");
    },
    codegenAction(api) {
      const done = api.emit("done");
      return `Directory.CreateDirectory(${api.input("path").code});${done ? `\n        ${done}();` : ""}`;
    }
  });

  registerNode("file.delete", {
    title: "Delete File / Directory",
    group: "Files & JSON",
    symbol: "DEL",
    description:
      "Deletes a file, or recursively deletes a directory when Recursive is enabled.",
    parameters: [
      pBool(
        "recursive",
        "Recursive directory delete",
        false
      )
    ],
    inputs: [
      port("call", "Call", "impulse"),
      port("path", "Path", "string")
    ],
    outputs: [port("done", "Done", "impulse")],
    codegenCollect(api) {
      api.addUsing("System.IO");
    },
    codegenAction(api) {
      const path = api.input("path").code;
      const recursive =
        api.node.parameters.recursive === true
          ? "true"
          : "false";
      const done = api.emit("done");
      return `if (File.Exists(${path}))\n        {\n            File.Delete(${path});\n        }\n        else if (Directory.Exists(${path}))\n        {\n            Directory.Delete(${path}, ${recursive});\n        }${done ? `\n        ${done}();` : ""}`;
    }
  });

  registerNode("file.enumerateFiles", {
    title: "Enumerate Files",
    group: "Files & JSON",
    symbol: "FILES",
    description:
      "Returns matching files from a directory.",
    parameters: [
      pSelect(
        "scope",
        "Search scope",
        [
          ["top", "Top directory only"],
          ["all", "All directories"]
        ],
        "top"
      )
    ],
    inputs: [
      port("directory", "Directory", "string"),
      port("pattern", "Pattern", "string")
    ],
    outputs: [port("files", "Files", "stringArray")],
    codegenCollect(api) {
      api.addUsing("System.IO");
    },
    codegenExpression(api) {
      const scope =
        api.node.parameters.scope === "all"
          ? "SearchOption.AllDirectories"
          : "SearchOption.TopDirectoryOnly";
      return `Directory.Exists(${api.input("directory").code}) ? Directory.GetFiles(${api.input("directory").code}, ${api.input("pattern").code}, ${scope}) : Array.Empty<string>()`;
    }
  });

  registerNode("json.parse", {
    title: "Parse JSON",
    group: "Files & JSON",
    symbol: "{}",
    description:
      "Parses text into System.Text.Json.Nodes.JsonNode.",
    inputs: [port("text", "JSON text", "string")],
    outputs: [port("json", "JSON", "json")],
    codegenExpression(api) {
      ensureJsonRuntime(api);
      return `ParseGraphJson(${api.input("text").code})!`;
    }
  });

  registerNode("json.serialize", {
    title: "Serialize JSON",
    group: "Files & JSON",
    symbol: "{}→T",
    description:
      "Serializes any value with System.Text.Json.",
    parameters: [
      pBool(
        "indented",
        "Indented",
        true
      )
    ],
    inputs: [port("value", "Value", "object")],
    outputs: [port("text", "JSON text", "string")],
    codegenExpression(api) {
      ensureJsonRuntime(api);
      return `SerializeGraphJson(${api.input("value").code}, ${api.node.parameters.indented === true ? "true" : "false"})`;
    }
  });

  registerNode("json.property", {
    title: "JSON Property / Path",
    group: "Files & JSON",
    symbol: ".JSON",
    description:
      "Reads nested object properties or array indexes with a dot-separated path.",
    inputs: [
      port("json", "JSON", "json"),
      port("path", "Path", "string")
    ],
    outputs: [port("value", "JSON value", "json")],
    codegenExpression(api) {
      ensureJsonRuntime(api);
      return `ReadGraphJsonProperty(${api.input("json").code}, ${api.input("path").code})!`;
    }
  });

  registerNode("json.asString", {
    title: "JSON As String",
    group: "Files & JSON",
    symbol: "JSON→T",
    description:
      "Reads a JSON string scalar or returns compact JSON text.",
    inputs: [port("json", "JSON", "json")],
    outputs: [port("text", "Text", "string")],
    codegenExpression(api) {
      ensureJsonRuntime(api);
      return `GraphJsonAsString(${api.input("json").code})`;
    }
  });

  registerNode("json.convert", {
    title: "JSON Convert To",
    group: "Files & JSON",
    symbol: "JSON→T",
    description:
      "Deserializes a JsonNode into the selected graph value type.",
    configurableTypeVar: "T",
    configurableTypes: COMMON_VALUE_TYPES.filter(
      type =>
        ![
          "json",
          "patchContext",
          "task",
          "cancellationToken"
        ].includes(type)
    ),
    defaultType: "string",
    inputs: [port("json", "JSON", "json")],
    outputs: [
      genericPort(
        "value",
        "Value",
        "T",
        "anyValue"
      )
    ],
    codegenExpression(api) {
      ensureJsonRuntime(api);
      return `${api.input("json").code}.Deserialize<${api.csType(
        api.node.parameters.valueType
      )}>()!`;
    }
  });

  registerNode("network.httpRequest", {
    title: "HTTP Request",
    group: "Networking",
    symbol: "HTTP",
    description:
      "Performs an asynchronous HttpClient request and emits Done when the response or error is available.",
    parameters: [
      pSelect(
        "method",
        "HTTP method",
        [
          "GET",
          "POST",
          "PUT",
          "PATCH",
          "DELETE",
          "HEAD"
        ],
        "GET"
      ),
      pText(
        "contentType",
        "Content type",
        "application/json"
      ),
      pCode(
        "headers",
        "Headers",
        "",
        "One Header: Value pair per line.",
        5
      )
    ],
    inputs: [
      port("call", "Send", "impulse"),
      port("url", "URL", "string"),
      port("body", "Body", "string")
    ],
    outputs: [
      port("done", "Done", "impulse"),
      port("response", "Response", "httpResponse"),
      port("status", "Status code", "int"),
      port("body", "Response body", "string"),
      port("contentType", "Content type", "string"),
      port("success", "Success", "bool"),
      port("error", "Error", "string")
    ],
    codegenCollect(api) {
      ensureNetworkRuntime(api);
      const token = nodeToken(api);
      const emit = api.emitMethod(
        api.node.id,
        "done"
      );
      api.addField(
        `${api.node.id}.response`,
        `private static GraphHttpResponse _httpResponse${token} = GraphHttpResponse.Empty;`
      );
      api.addMember(
        `${api.node.id}.send`,
        `private static async void SendHttp${token}(string url, string body)\n{\n    try\n    {\n        using HttpRequestMessage request = new(new HttpMethod(${quote(
          api,
          api.node.parameters.method || "GET"
        )}), url);\n\n        if (!string.IsNullOrEmpty(body) && request.Method != HttpMethod.Get && request.Method != HttpMethod.Head)\n        {\n            request.Content = new StringContent(body, Encoding.UTF8, ${quote(
          api,
          api.node.parameters.contentType ||
            "application/json"
        )});\n        }\n\n        foreach (string line in ${quote(
          api,
          api.node.parameters.headers || ""
        )}.Split('\\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))\n        {\n            int separator = line.IndexOf(':');\n            if (separator <= 0) continue;\n            string name = line[..separator].Trim();\n            string value = line[(separator + 1)..].Trim();\n            if (!request.Headers.TryAddWithoutValidation(name, value))\n            {\n                request.Content?.Headers.TryAddWithoutValidation(name, value);\n            }\n        }\n\n        using HttpResponseMessage response = await _graphHttpClient.SendAsync(request).ConfigureAwait(false);\n        string responseBody = await response.Content.ReadAsStringAsync().ConfigureAwait(false);\n        _httpResponse${token} = new GraphHttpResponse(\n            (int)response.StatusCode,\n            responseBody,\n            response.Content.Headers.ContentType?.ToString() ?? string.Empty,\n            response.IsSuccessStatusCode,\n            string.Empty);\n    }\n    catch (Exception exception)\n    {\n        _httpResponse${token} = new GraphHttpResponse(\n            0,\n            string.Empty,\n            string.Empty,\n            false,\n            exception.ToString());\n    }${emit ? `\n\n    ${emit}();` : ""}\n}`
      );
    },
    codegenExpression(api) {
      const field = `_httpResponse${nodeToken(api)}`;
      switch (api.portId) {
        case "status":
          return `${field}.StatusCode`;
        case "body":
          return `${field}.Body`;
        case "contentType":
          return `${field}.ContentType`;
        case "success":
          return `${field}.Success`;
        case "error":
          return `${field}.Error`;
        default:
          return field;
      }
    },
    codegenAction(api) {
      return `SendHttp${nodeToken(api)}(${api.input("url").code}, ${api.input("body").code});`;
    }
  });

  registerNode("network.webSocket", {
    title: "WebSocket Client",
    group: "Networking",
    symbol: "WS",
    description:
      "Connects a ClientWebSocket, receives text/binary messages and exposes connection events.",
    parameters: [
      pCode(
        "headers",
        "Request headers",
        "",
        "One Header: Value pair per line.",
        5
      )
    ],
    inputs: [
      port("connect", "Connect", "impulse"),
      port("close", "Close", "impulse"),
      port("url", "URL", "string")
    ],
    outputs: [
      port("connected", "Connected", "impulse"),
      port("message", "Message", "impulse"),
      port("closed", "Closed", "impulse"),
      port("socket", "Socket", "webSocket"),
      port("text", "Latest text", "string"),
      port("bytes", "Latest bytes", "byteArray"),
      port("isConnected", "Is connected", "bool"),
      port("error", "Error", "string")
    ],
    codegenCollect(api) {
      ensureNetworkRuntime(api);
      api.addUsing("System.IO");
      const token = nodeToken(api);
      const connected = api.emitMethod(
        api.node.id,
        "connected"
      );
      const message = api.emitMethod(
        api.node.id,
        "message"
      );
      const closed = api.emitMethod(
        api.node.id,
        "closed"
      );
      api.addField(
        `${api.node.id}.socket`,
        `private static ClientWebSocket _webSocket${token} = null!;`
      );
      api.addField(
        `${api.node.id}.text`,
        `private static string _webSocketText${token} = string.Empty;`
      );
      api.addField(
        `${api.node.id}.bytes`,
        `private static byte[] _webSocketBytes${token} = Array.Empty<byte>();`
      );
      api.addField(
        `${api.node.id}.connected`,
        `private static bool _webSocketConnected${token};`
      );
      api.addField(
        `${api.node.id}.error`,
        `private static string _webSocketError${token} = string.Empty;`
      );
      api.addMember(
        `${api.node.id}.connect`,
        `private static async void ConnectWebSocket${token}(string url)\n{\n    try\n    {\n        if (_webSocket${token} is not null)\n        {\n            _webSocket${token}.Dispose();\n        }\n\n        _webSocket${token} = new ClientWebSocket();\n        _webSocketError${token} = string.Empty;\n\n        foreach (string line in ${quote(
          api,
          api.node.parameters.headers || ""
        )}.Split('\\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))\n        {\n            int separator = line.IndexOf(':');\n            if (separator > 0)\n            {\n                _webSocket${token}.Options.SetRequestHeader(\n                    line[..separator].Trim(),\n                    line[(separator + 1)..].Trim());\n            }\n        }\n\n        await _webSocket${token}.ConnectAsync(new Uri(url), CancellationToken.None).ConfigureAwait(false);\n        _webSocketConnected${token} = true;${connected ? `\n        ${connected}();` : ""}\n\n        byte[] buffer = new byte[64 * 1024];\n\n        while (_webSocket${token}.State == WebSocketState.Open)\n        {\n            using MemoryStream frame = new();\n            WebSocketReceiveResult result;\n\n            do\n            {\n                result = await _webSocket${token}\n                    .ReceiveAsync(buffer, CancellationToken.None)\n                    .ConfigureAwait(false);\n\n                if (result.Count > 0)\n                {\n                    frame.Write(buffer, 0, result.Count);\n                }\n            }\n            while (!result.EndOfMessage);\n\n            if (result.MessageType == WebSocketMessageType.Close)\n            {\n                break;\n            }\n\n            _webSocketBytes${token} = frame.ToArray();\n            _webSocketText${token} = result.MessageType == WebSocketMessageType.Text\n                ? Encoding.UTF8.GetString(_webSocketBytes${token})\n                : string.Empty;${message ? `\n            ${message}();` : ""}\n        }\n    }\n    catch (Exception exception)\n    {\n        _webSocketError${token} = exception.ToString();\n    }\n    finally\n    {\n        _webSocketConnected${token} = false;${closed ? `\n        ${closed}();` : ""}\n    }\n}\n\nprivate static async void CloseWebSocket${token}()\n{\n    try\n    {\n        if (_webSocket${token}?.State == WebSocketState.Open)\n        {\n            await _webSocket${token}\n                .CloseAsync(WebSocketCloseStatus.NormalClosure, "Graph close", CancellationToken.None)\n                .ConfigureAwait(false);\n        }\n    }\n    catch (Exception exception)\n    {\n        _webSocketError${token} = exception.ToString();\n    }\n}`
      );
    },
    codegenExpression(api) {
      const token = nodeToken(api);
      switch (api.portId) {
        case "text":
          return `_webSocketText${token}`;
        case "bytes":
          return `_webSocketBytes${token}`;
        case "isConnected":
          return `_webSocketConnected${token}`;
        case "error":
          return `_webSocketError${token}`;
        default:
          return `_webSocket${token}`;
      }
    },
    codegenAction(api) {
      return api.connection.toPort === "close"
        ? `CloseWebSocket${nodeToken(api)}();`
        : `ConnectWebSocket${nodeToken(api)}(${api.input("url").code});`;
    }
  });

  registerNode("network.webSocketSend", {
    title: "WebSocket Send",
    group: "Networking",
    symbol: "WS→",
    description:
      "Sends a text message over an open ClientWebSocket.",
    inputs: [
      port("call", "Send", "impulse"),
      port("socket", "Socket", "webSocket"),
      port("text", "Text", "string")
    ],
    outputs: [
      port("done", "Done", "impulse"),
      port("error", "Error", "string")
    ],
    codegenCollect(api) {
      ensureNetworkRuntime(api);
      const token = nodeToken(api);
      const done = api.emitMethod(
        api.node.id,
        "done"
      );
      api.addField(
        `${api.node.id}.error`,
        `private static string _webSocketSendError${token} = string.Empty;`
      );
      api.addMember(
        `${api.node.id}.send`,
        `private static async void SendWebSocket${token}(ClientWebSocket socket, string text)\n{\n    try\n    {\n        _webSocketSendError${token} = string.Empty;\n        byte[] data = Encoding.UTF8.GetBytes(text ?? string.Empty);\n        await socket.SendAsync(data, WebSocketMessageType.Text, true, CancellationToken.None).ConfigureAwait(false);\n    }\n    catch (Exception exception)\n    {\n        _webSocketSendError${token} = exception.ToString();\n    }${done ? `\n\n    ${done}();` : ""}\n}`
      );
    },
    codegenExpression(api) {
      return `_webSocketSendError${nodeToken(api)}`;
    },
    codegenAction(api) {
      return `SendWebSocket${nodeToken(api)}(${api.input("socket").code}, ${api.input("text").code});`;
    }
  });

  registerNode("network.tcpSend", {
    title: "TCP Send Text",
    group: "Networking",
    symbol: "TCP",
    description:
      "Connects to a TCP host, sends UTF-8 text and closes the connection.",
    inputs: [
      port("call", "Send", "impulse"),
      port("host", "Host", "string"),
      port("port", "Port", "int"),
      port("text", "Text", "string")
    ],
    outputs: [
      port("done", "Done", "impulse"),
      port("error", "Error", "string")
    ],
    codegenCollect(api) {
      ensureNetworkRuntime(api);
      const token = nodeToken(api);
      const done = api.emitMethod(
        api.node.id,
        "done"
      );
      api.addField(
        `${api.node.id}.error`,
        `private static string _tcpError${token} = string.Empty;`
      );
      api.addMember(
        `${api.node.id}.send`,
        `private static async void SendTcp${token}(string host, int port, string text)\n{\n    try\n    {\n        _tcpError${token} = string.Empty;\n        using TcpClient client = new();\n        await client.ConnectAsync(host, port).ConfigureAwait(false);\n        byte[] data = Encoding.UTF8.GetBytes(text ?? string.Empty);\n        await client.GetStream().WriteAsync(data).ConfigureAwait(false);\n    }\n    catch (Exception exception)\n    {\n        _tcpError${token} = exception.ToString();\n    }${done ? `\n\n    ${done}();` : ""}\n}`
      );
    },
    codegenExpression(api) {
      return `_tcpError${nodeToken(api)}`;
    },
    codegenAction(api) {
      return `SendTcp${nodeToken(api)}(${api.input("host").code}, ${api.input("port").code}, ${api.input("text").code});`;
    }
  });

  registerNode("network.udpSend", {
    title: "UDP Send Text",
    group: "Networking",
    symbol: "UDP",
    description:
      "Sends one UTF-8 datagram to a host and port.",
    inputs: [
      port("call", "Send", "impulse"),
      port("host", "Host", "string"),
      port("port", "Port", "int"),
      port("text", "Text", "string")
    ],
    outputs: [
      port("done", "Done", "impulse"),
      port("error", "Error", "string")
    ],
    codegenCollect(api) {
      ensureNetworkRuntime(api);
      const token = nodeToken(api);
      const done = api.emitMethod(
        api.node.id,
        "done"
      );
      api.addField(
        `${api.node.id}.error`,
        `private static string _udpError${token} = string.Empty;`
      );
      api.addMember(
        `${api.node.id}.send`,
        `private static async void SendUdp${token}(string host, int port, string text)\n{\n    try\n    {\n        _udpError${token} = string.Empty;\n        using UdpClient client = new();\n        byte[] data = Encoding.UTF8.GetBytes(text ?? string.Empty);\n        await client.SendAsync(data, data.Length, host, port).ConfigureAwait(false);\n    }\n    catch (Exception exception)\n    {\n        _udpError${token} = exception.ToString();\n    }${done ? `\n\n    ${done}();` : ""}\n}`
      );
    },
    codegenExpression(api) {
      return `_udpError${nodeToken(api)}`;
    },
    codegenAction(api) {
      return `SendUdp${nodeToken(api)}(${api.input("host").code}, ${api.input("port").code}, ${api.input("text").code});`;
    }
  });

  registerNode("task.delay", {
    title: "Delay",
    group: "Tasks & Threading",
    symbol: "WAIT",
    description:
      "Waits asynchronously without blocking the Resonite thread, then emits Done.",
    inputs: [
      port("call", "Start", "impulse"),
      port("milliseconds", "Milliseconds", "int")
    ],
    outputs: [port("done", "Done", "impulse")],
    codegenCollect(api) {
      ensureTaskRuntime(api);
      const token = nodeToken(api);
      const done = api.emitMethod(
        api.node.id,
        "done"
      );
      api.addMember(
        `${api.node.id}.delay`,
        `private static async void Delay${token}(int milliseconds)\n{\n    await Task.Delay(Math.Max(0, milliseconds)).ConfigureAwait(false);${done ? `\n    ${done}();` : ""}\n}`
      );
    },
    codegenAction(api) {
      return `Delay${nodeToken(api)}(${api.input("milliseconds").code});`;
    }
  });

  registerNode("task.background", {
    title: "Run On ThreadPool",
    group: "Tasks & Threading",
    symbol: "BG",
    description:
      "Emits Background on a Task.Run worker and Completed when that path returns.",
    inputs: [port("call", "Start", "impulse")],
    outputs: [
      port("background", "Background", "impulse"),
      port("completed", "Completed", "impulse")
    ],
    codegenCollect(api) {
      ensureTaskRuntime(api);
      const token = nodeToken(api);
      const background = api.emitMethod(
        api.node.id,
        "background"
      );
      const completed = api.emitMethod(
        api.node.id,
        "completed"
      );
      api.addMember(
        `${api.node.id}.run`,
        `private static void RunBackground${token}()\n{\n    _ = Task.Run(() =>\n    {${background ? `\n        ${background}();` : ""}\n    }).ContinueWith(_ =>\n    {${completed ? `\n        ${completed}();` : ""}\n    }, TaskScheduler.Default);\n}`
      );
    },
    codegenAction(api) {
      return `RunBackground${nodeToken(api)}();`;
    }
  });

  registerNode("task.dispatchResonite", {
    title: "Dispatch To Resonite",
    group: "Tasks & Threading",
    symbol: "MAIN",
    description:
      "Attempts common Engine dispatcher methods through reflection and falls back to immediate execution.",
    inputs: [port("call", "Dispatch", "impulse")],
    outputs: [port("run", "Run", "impulse")],
    codegenCollect(api) {
      ensureResoniteRuntime(api);
    },
    codegenAction(api) {
      const run = api.emit("run");
      return run
        ? `DispatchToResonite(() => ${run}());`
        : "";
    }
  });

  registerNode("task.await", {
    title: "Await Task",
    group: "Tasks & Threading",
    symbol: "AWAIT",
    description:
      "Awaits a Task asynchronously and emits Done or Faulted.",
    inputs: [
      port("call", "Await", "impulse"),
      port("task", "Task", "task")
    ],
    outputs: [
      port("done", "Done", "impulse"),
      port("faulted", "Faulted", "impulse"),
      port("exception", "Exception", "exception")
    ],
    codegenCollect(api) {
      ensureTaskRuntime(api);
      const token = nodeToken(api);
      const done = api.emitMethod(
        api.node.id,
        "done"
      );
      const faulted = api.emitMethod(
        api.node.id,
        "faulted"
      );
      api.addField(
        `${api.node.id}.exception`,
        `private static Exception _awaitException${token} = null!;`
      );
      api.addMember(
        `${api.node.id}.await`,
        `private static async void AwaitTask${token}(Task task)\n{\n    try\n    {\n        _awaitException${token} = null!;\n        await task.ConfigureAwait(false);${done ? `\n        ${done}();` : ""}\n    }\n    catch (Exception exception)\n    {\n        _awaitException${token} = exception;${faulted ? `\n        ${faulted}();` : ""}\n    }\n}`
      );
    },
    codegenExpression(api) {
      return `_awaitException${nodeToken(api)}`;
    },
    codegenAction(api) {
      return `AwaitTask${nodeToken(api)}(${api.input("task").code});`;
    }
  });

  registerNode("task.completedTask", {
    title: "Completed Task",
    group: "Tasks & Threading",
    symbol: "TASK",
    description: "Task.CompletedTask.",
    outputs: [port("task", "Task", "task")],
    codegenCollect(api) {
      ensureTaskRuntime(api);
    },
    codegenExpression() {
      return "Task.CompletedTask";
    }
  });

  registerNode("flow.customEvent", {
    title: "Custom Event",
    group: "Flow",
    symbol: "EV",
    description:
      "A named graph event source that can be raised from any impulse path.",
    inputs: [port("raise", "Raise", "impulse")],
    outputs: [port("event", "Event", "impulse")],
    codegenAction(api) {
      const emit = api.emit("event");
      return emit ? `${emit}();` : "";
    }
  });

  registerNode("csharp.expression", {
    title: "C# Expression",
    group: "C# Advanced",
    symbol: "C#=",
    description:
      "Universal typed expression escape hatch. Placeholders {A}…{H}, {MOD}, {GRAPH}, {NAMESPACE} and {NODE} are replaced during export.",
    configurableTypeVar: "T",
    configurableTypes: COMMON_VALUE_TYPES,
    defaultType: "object",
    parameters: [
      pCode(
        "code",
        "Expression",
        "{A}",
        "Enter one valid C# expression without a trailing semicolon.",
        8
      )
    ],
    inputs: [
      port("a", "A", "object"),
      port("b", "B", "object"),
      port("c", "C", "object"),
      port("d", "D", "object"),
      port("e", "E", "object"),
      port("f", "F", "object"),
      port("g", "G", "object"),
      port("h", "H", "object")
    ],
    outputs: [
      genericPort(
        "result",
        "Result",
        "T",
        "anyValue"
      )
    ],
    codegenExpression(api) {
      api.warning(
        "C# Expression nodes are exported verbatim and cannot be fully type-checked by the browser."
      );
      const code = replaceInputPlaceholders(
        api.node.parameters.code,
        api,
        ["a", "b", "c", "d", "e", "f", "g", "h"]
      ).trim();
      return code || api.csDefault(
        api.node.parameters.valueType
      );
    }
  });

  registerNode("csharp.action", {
    title: "C# Action",
    group: "C# Advanced",
    symbol: "C#;",
    description:
      "Universal statement escape hatch. {A}…{H} are input expressions; {NEXT} calls the Done output. When {NEXT} is absent, Done is appended automatically.",
    parameters: [
      pCode(
        "code",
        "Statements",
        "_display(FormatValue({A}));",
        "Statements are inserted inside the generated impulse method.",
        12
      )
    ],
    inputs: [
      port("call", "Call", "impulse"),
      port("a", "A", "object"),
      port("b", "B", "object"),
      port("c", "C", "object"),
      port("d", "D", "object"),
      port("e", "E", "object"),
      port("f", "F", "object"),
      port("g", "G", "object"),
      port("h", "H", "object")
    ],
    outputs: [port("done", "Done", "impulse")],
    codegenAction(api) {
      api.warning(
        "C# Action nodes are exported verbatim and can call any referenced API."
      );
      const nextMethod = api.emit("done");
      const next = nextMethod
        ? `${nextMethod}();`
        : "";
      let code = replaceInputPlaceholders(
        api.node.parameters.code,
        api,
        ["a", "b", "c", "d", "e", "f", "g", "h"]
      );
      const containedNext =
        code.includes("{NEXT}");
      code = replaceCodePlaceholders(
        code,
        api,
        {
          NEXT: next
        }
      ).trim();
      if (!containedNext && next) {
        code = `${code}${code ? "\n" : ""}${next}`;
      }
      return code;
    }
  });

  registerNode("csharp.runtimeMember", {
    title: "C# Graph Runtime Member",
    group: "C# Advanced",
    symbol: "MEM",
    description:
      "Adds fields, methods, nested types or properties directly inside the generated static NodeGraph class.",
    parameters: [
      pCode(
        "code",
        "Class member code",
        "private static object? CustomState;",
        "Do not include an outer class or namespace declaration.",
        14
      )
    ],
    codegenCollect(api) {
      const code = replaceCodePlaceholders(
        api.node.parameters.code,
        api
      ).trim();
      if (code) {
        api.addMember(
          `${api.node.id}.rawRuntimeMember`,
          code
        );
        api.warning(
          "A C# Graph Runtime Member is included verbatim."
        );
      }
    }
  });

  registerNode("csharp.mainMember", {
    title: "C# Main Mod Member",
    group: "C# Advanced",
    symbol: "MOD",
    description:
      "Adds fields, helpers or nested types inside the generated public partial ResoniteMod class.",
    parameters: [
      pCode(
        "code",
        "Partial class member code",
        "private static void CustomHelper()\n{\n}\n",
        "Do not include an outer class or namespace declaration.",
        16
      )
    ]
  });

  registerNode("csharp.additionalSource", {
    title: "Additional C# Source File",
    group: "C# Advanced",
    symbol: ".CS",
    description:
      "Exports a complete additional source file. This makes arbitrary classes, services, exact API adapters and platform code possible.",
    parameters: [
      pText(
        "fileName",
        "File name",
        "AdditionalRuntime.cs"
      ),
      pCode(
        "content",
        "Complete C# source",
        "using System;\n\nnamespace {NAMESPACE};\n\ninternal static class AdditionalRuntime\n{\n}\n",
        "The complete file is exported verbatim after placeholder replacement.",
        20
      )
    ]
  });

  registerNode("harmony.exactPatchSource", {
    title: "Harmony Exact Patch Source",
    group: "Harmony",
    symbol: "H.CS",
    description:
      "Exports a complete Harmony patch source file for exact signatures, transpilers, reverse-patch stand-ins, ref returns and advanced state handling.",
    parameters: [
      pText(
        "fileName",
        "File name",
        "ExactHarmonyPatches.cs"
      ),
      pCode(
        "content",
        "Complete patch source",
        "using HarmonyLib;\n\nnamespace {NAMESPACE};\n\n[HarmonyPatch]\ninternal static class ExactHarmonyPatches\n{\n    // Add [HarmonyPatch] targets and exact Prefix/Postfix/Finalizer/Transpiler methods here.\n}\n",
        "This file is exported verbatim and automatically adds the 0Harmony reference.",
        24
      )
    ]
  });

  registerNode("csharp.using", {
    title: "Add Using Namespace",
    group: "C# Advanced",
    symbol: "USING",
    description:
      "Adds a using directive to the generated NodeGraph runtime file.",
    parameters: [
      pText(
        "namespace",
        "Namespace",
        "System.Diagnostics"
      )
    ]
  });

  registerNode("csharp.assemblyReference", {
    title: "Assembly Reference",
    group: "C# Advanced",
    symbol: "DLL",
    description:
      "Adds a direct MSBuild Reference to the generated .csproj.",
    parameters: [
      pText(
        "include",
        "Assembly include",
        "MyLibrary"
      ),
      pText(
        "hintPath",
        "HintPath",
        "$(ResonitePath)Libraries/MyLibrary.dll"
      ),
      pBool(
        "copyLocal",
        "Copy local",
        false
      )
    ]
  });

  registerNode("csharp.packageReference", {
    title: "NuGet Package Reference",
    group: "C# Advanced",
    symbol: "NUGET",
    description:
      "Adds a PackageReference to the generated .csproj.",
    parameters: [
      pText(
        "include",
        "Package",
        "Newtonsoft.Json"
      ),
      pText(
        "version",
        "Version",
        "13.0.3"
      ),
      pText(
        "privateAssets",
        "PrivateAssets",
        ""
      ),
      pText(
        "includeAssets",
        "IncludeAssets",
        ""
      )
    ]
  });

  registerNode("csharp.frameworkReference", {
    title: "Framework Reference",
    group: "C# Advanced",
    symbol: "FX",
    description:
      "Adds a FrameworkReference, for example Microsoft.AspNetCore.App.",
    parameters: [
      pText(
        "include",
        "Framework",
        "Microsoft.AspNetCore.App"
      )
    ]
  });

  registerNode("csharp.buildOptions", {
    title: "C# Build Options",
    group: "C# Advanced",
    symbol: "BUILD",
    description:
      "Enables project-level options required by native interop or Windows UI code.",
    parameters: [
      pBool(
        "unsafe",
        "Allow unsafe blocks",
        false
      ),
      pBool(
        "windowsForms",
        "Use Windows Forms",
        false
      )
    ]
  });

  registerCodegenPlugin({
    collect(api) {
      const nodes = Array.isArray(api.nodes)
        ? api.nodes
        : [];

      const mainMembers = [];
      let advancedCodeUsed = false;

      for (const node of nodes) {
        if (
          !node ||
          node.kind !== "operator"
        ) {
          continue;
        }

        switch (node.operatorId) {
          case "csharp.using": {
            const value = String(
              node.parameters?.namespace || ""
            ).trim();
            if (value) {
              api.addUsing(value);
            }
            break;
          }

          case "csharp.assemblyReference":
            api.addReference({
              include:
                node.parameters?.include,
              hintPath:
                node.parameters?.hintPath,
              private:
                node.parameters?.copyLocal ===
                true
            });
            break;

          case "csharp.packageReference":
            api.addPackageReference({
              include:
                node.parameters?.include,
              version:
                node.parameters?.version,
              privateAssets:
                node.parameters?.privateAssets,
              includeAssets:
                node.parameters?.includeAssets
            });
            break;

          case "csharp.frameworkReference":
            api.addFrameworkReference(
              node.parameters?.include
            );
            break;

          case "csharp.buildOptions":
            api.require(
              "allowUnsafeBlocks",
              node.parameters?.unsafe === true
            );
            api.require(
              "useWindowsForms",
              node.parameters?.windowsForms ===
                true
            );
            break;

          case "csharp.mainMember": {
            const code = replaceCodePlaceholders(
              node.parameters?.code,
              {
                ...api,
                node,
                definition:
                  api.definitions?.[
                    node.operatorId
                  ]
              }
            ).trim();
            if (code) {
              mainMembers.push(code);
              advancedCodeUsed = true;
            }
            break;
          }

          case "csharp.additionalSource": {
            const fileName = String(
              node.parameters?.fileName ||
                "AdditionalRuntime.cs"
            ).trim();
            const content =
              replaceCodePlaceholders(
                node.parameters?.content,
                {
                  ...api,
                  node,
                  definition:
                    api.definitions?.[
                      node.operatorId
                    ]
                }
              );
            api.addFile({
              name: fileName,
              content
            });
            advancedCodeUsed = true;
            break;
          }

          case "harmony.exactPatchSource": {
            ensureHarmonyRuntime({
              ...api,
              node,
              definition:
                api.definitions?.[
                  node.operatorId
                ]
            });
            const fileName = String(
              node.parameters?.fileName ||
                "ExactHarmonyPatches.cs"
            ).trim();
            const content =
              replaceCodePlaceholders(
                node.parameters?.content,
                {
                  ...api,
                  node,
                  definition:
                    api.definitions?.[
                      node.operatorId
                    ]
                }
              );
            api.addFile({
              name: fileName,
              content
            });
            advancedCodeUsed = true;
            break;
          }

          case "csharp.expression":
          case "csharp.action":
          case "csharp.runtimeMember":
            advancedCodeUsed = true;
            break;
        }
      }

      if (mainMembers.length > 0) {
        const indented = mainMembers
          .map(member =>
            member
              .split("\n")
              .map(line =>
                line.length > 0
                  ? `    ${line}`
                  : ""
              )
              .join("\n")
          )
          .join("\n\n");

        api.addFile({
          name:
            `${api.className}.Custom.cs`,
          content:
`using System;
using ResoniteModLoader;

namespace ${api.namespaceName};

public sealed partial class ${api.className}
{
${indented}
}
`
        });
      }

      if (advancedCodeUsed) {
        api.warning(
          "Advanced C# nodes remove the expressiveness ceiling, but their source is intentionally exported verbatim and must be compiled against the target Resonite/RML assemblies."
        );
      }

      const deprecated = nodes.filter(
        node =>
          [
            "resonite.dataModelStore",
            "resonite.dynamicRead",
            "resonite.dynamicWrite"
          ].includes(node.operatorId)
      );

      if (deprecated.length > 0) {
        api.warning(
          "This project still contains deprecated graph-local pseudo-Resonite nodes. Replace them with real Slot/Component/Sync nodes."
        );
      }
    }
  });
})();
