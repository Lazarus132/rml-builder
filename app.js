"use strict";

const STORAGE_KEY = "rml-configuration-builder-standalone-v1";
const ROOT_CONTAINER = "root";
const DRAG_SCROLL_EDGE = 110;
const DRAG_SCROLL_MAX_SPEED = 22;
const VECTOR_COMPONENT_NAMES = ["X", "Y", "Z", "W"];

const COLORX_NAMED_PREVIEWS = {
  White: { channels: [1, 1, 1, 1], label: "White" },
  Black: { channels: [0, 0, 0, 1], label: "Black" },
  Red: { channels: [1, 0, 0, 1], label: "Red" },
  Green: { channels: [0, 1, 0, 1], label: "Green" },
  Blue: { channels: [0, 0, 1, 1], label: "Blue" },
  Yellow: { channels: [1, 1, 0, 1], label: "Yellow" },
  Cyan: { channels: [0, 1, 1, 1], label: "Cyan" },
  Magenta: { channels: [1, 0, 1, 1], label: "Magenta" },
  Gray: { channels: [0.5, 0.5, 0.5, 1], label: "Gray" },
  Clear: { channels: [0, 0, 0, 0], label: "Clear" }
};

const TYPE_DEFINITIONS = [
  { type: "bool", label: "Boolean", group: "Core", badge: "BOOL" },
  { type: "string", label: "Text", group: "Core", badge: "TXT" },
  { type: "Uri", label: "URL / URI", group: "Core", badge: "URI" },
  { type: "enum", label: "Normal enum", group: "Core", badge: "ENUM" },
  { type: "int", label: "Integer", group: "Numbers", badge: "INT" },
  { type: "float", label: "Float", group: "Numbers", badge: "F32" },
  { type: "double", label: "Double", group: "Numbers", badge: "F64" },
  { type: "int2", label: "Integer 2", group: "Vectors", badge: "I2" },
  { type: "int3", label: "Integer 3", group: "Vectors", badge: "I3" },
  { type: "int4", label: "Integer 4", group: "Vectors", badge: "I4" },
  { type: "float2", label: "Float 2", group: "Vectors", badge: "F2" },
  { type: "float3", label: "Float 3", group: "Vectors", badge: "F3" },
  { type: "float4", label: "Float 4", group: "Vectors", badge: "F4" },
  { type: "double2", label: "Double 2", group: "Vectors", badge: "D2" },
  { type: "double3", label: "Double 3", group: "Vectors", badge: "D3" },
  { type: "double4", label: "Double 4", group: "Vectors", badge: "D4" },
  { type: "colorX", label: "HDR color", group: "Visual", badge: "CLR" }
];

const DEFAULT_METADATA = {
  namespaceName: "YourModNamespace",
  className: "YourMod",
  modName: "Your Mod",
  author: "Your Name",
  version: "1.0.0",
  description: "A Resonite mod generated with the RML Configuration Builder.",
  includeGuide: true
};

const EXPORT_PLATFORM_PRESETS = {
  windows:
    "C:\\Program Files (x86)\\Steam\\steamapps\\common\\Resonite\\",
  linux:
    "$(HOME)/.local/share/Steam/steamapps/common/Resonite/",
  "linux-flatpak":
    "$(HOME)/.var/app/com.valvesoftware.Steam/.local/share/Steam/steamapps/common/Resonite/",
  macos:
    "$(HOME)/Library/Application Support/Steam/steamapps/common/Resonite/"
};

const DEFAULT_EXPORT_OPTIONS = {
  platform: "windows",
  resonitePath: EXPORT_PLATFORM_PRESETS.windows,
  includeCs: true,
  includeCsproj: true
};

const SAMPLE_NODES = [
  {
    id: "controller-main",
    kind: "controller",
    fieldName: "ActivePage",
    keyName: "00_active_page",
    description: "Selects the visible settings page.",
    enumName: "SettingsPage",
    defaultOption: "General",
    reaction: "stored",
    options: [
      {
        id: "option-general",
        name: "General",
        children: [
          makeSampleSetting(
            "setting-enabled",
            "bool",
            "Enabled",
            "10_enabled",
            "Enables this mod.",
            "true",
            "startup-saved"
          ),
          makeSampleSetting(
            "setting-name",
            "string",
            "DisplayName",
            "11_display_name",
            "Example text setting.",
            "Example"
          ),
          makeSampleSetting(
            "setting-resource",
            "Uri",
            "ResourceUri",
            "12_resource_uri",
            "Any URL or URI with a copy button.",
            "https://example.com/resource"
          )
        ]
      },
      {
        id: "option-appearance",
        name: "Appearance",
        children: [
          {
            ...makeSampleSetting(
              "setting-quality",
              "enum",
              "Quality",
              "20_quality",
              "Ordinary enum setting.",
              "Medium",
              "startup-saved"
            ),
            enumName: "QualityLevel",
            enumOptions: ["Low", "Medium", "High"]
          },
          makeSampleSetting(
            "setting-color",
            "colorX",
            "AccentColor",
            "21_accent_color",
            "HDR-capable accent color.",
            "colorX.Red",
            "startup-saved"
          ),
          {
            ...makeSampleSetting(
              "setting-scale",
              "float",
              "Scale",
              "22_scale",
              "Float slider from 0.1 to 10.",
              "1",
              "startup-saved"
            ),
            validatorMode: "range",
            useSlider: true,
            minimum: "0.1",
            maximum: "10"
          }
        ]
      },
      {
        id: "option-advanced",
        name: "Advanced",
        children: [
          {
            ...makeSampleSetting(
              "setting-precise",
              "double",
              "PreciseValue",
              "30_precise_value",
              "Double slider from -100 to 100.",
              "0.12345678901234567"
            ),
            validatorMode: "range",
            useSlider: true,
            minimum: "-100",
            maximum: "100"
          },
          makeSampleSetting(
            "setting-vector",
            "double3",
            "PrecisePosition",
            "31_precise_position",
            "Three-component double vector.",
            "1.25, 2.5, 3.75"
          )
        ]
      }
    ]
  }
];

const state = {
  metadata: { ...DEFAULT_METADATA },
  exportOptions: { ...DEFAULT_EXPORT_OPTIONS },
  nodes: [],
  selectedId: null,
  activeContainerId: ROOT_CONTAINER,
  dragOverContainer: null
};

const elements = {};

let dragScrollActive = false;
let dragPointerY = null;
let dragScrollFrame = null;

function makeSampleSetting(
  id,
  valueType,
  fieldName,
  keyName,
  description,
  defaultValue,
  reaction = "stored"
) {
  return {
    id,
    kind: "setting",
    valueType,
    fieldName,
    keyName,
    description,
    defaultValue,
    hidden: false,
    validatorMode: "none",
    customValidator: "",
    useSlider: false,
    minimum: "0",
    maximum: "100",
    enumName: "",
    enumOptions: [],
    reaction
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function toPascalCase(value, fallback = "Setting") {
  const words = String(value)
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
  const result = words
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");
  const safe = result || fallback;
  return /^[0-9]/.test(safe) ? `Value${safe}` : safe;
}

function toSnakeCase(value, fallback = "setting") {
  const result = String(value)
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
  return result || fallback;
}

function toCamelCase(value) {
  const pascal = toPascalCase(value, "value");
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

function escapeCSharp(value) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/\t/g, "\\t")
    .replace(/\0/g, "\\0")
    .replace(/"/g, '\\"');
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function generatedBaseName() {
  return toPascalCase(
    state.metadata.className,
    "YourMod"
  );
}

function normalizedResonitePath(value) {
  const compact = String(value || "")
    .replace(/\r\n|\r|\n/g, "")
    .trim();
  const path =
    compact ||
    DEFAULT_EXPORT_OPTIONS.resonitePath;

  if (/[\\/]$/.test(path)) {
    return path;
  }

  return path.includes("\\")
    ? `${path}\\`
    : `${path}/`;
}

function inferExportPlatform(path) {
  const normalized =
    normalizedResonitePath(path);

  for (
    const [
      platform,
      presetPath
    ] of Object.entries(
      EXPORT_PLATFORM_PRESETS
    )
  ) {
    if (
      normalized ===
      normalizedResonitePath(
        presetPath
      )
    ) {
      return platform;
    }
  }

  return "custom";
}

function clamp(value, minimum, maximum) {
  return Math.min(
    maximum,
    Math.max(
      minimum,
      value
    )
  );
}

function numericInputValue(value) {
  return String(value)
    .trim()
    .replace(/[fFdD]$/, "");
}

function vectorComponentValues(
  value,
  count
) {
  const parts =
    String(value)
      .split(",")
      .map(part =>
        numericInputValue(part)
      );

  while (parts.length < count) {
    parts.push("0");
  }

  return parts
    .slice(0, count)
    .map(part =>
      part || "0"
    );
}

function colorByteToHex(value) {
  return clamp(
    Math.round(value),
    0,
    255
  )
    .toString(16)
    .padStart(2, "0");
}

function colorChannelsToPreview(
  channels,
  label
) {
  const [red, green, blue, alpha] =
    channels;

  const clampedRed =
    clamp(red, 0, 1);
  const clampedGreen =
    clamp(green, 0, 1);
  const clampedBlue =
    clamp(blue, 0, 1);
  const clampedAlpha =
    clamp(alpha, 0, 1);

  const redByte =
    clampedRed * 255;
  const greenByte =
    clampedGreen * 255;
  const blueByte =
    clampedBlue * 255;

  const hex =
    `#${colorByteToHex(redByte)}` +
    `${colorByteToHex(greenByte)}` +
    `${colorByteToHex(blueByte)}`;

  const outsideStandardRange =
    channels.some(
      (value, index) =>
        index < 3 &&
        (value < 0 || value > 1)
    );
  const luminance =
    0.2126 * clampedRed +
    0.7152 * clampedGreen +
    0.0722 * clampedBlue;

  return {
    channels: [
      red,
      green,
      blue,
      alpha
    ],
    hex,
    cssColor:
      `rgba(${Math.round(redByte)}, ` +
      `${Math.round(greenByte)}, ` +
      `${Math.round(blueByte)}, ` +
      `${clampedAlpha})`,
    textColor:
      luminance > 0.62 &&
      clampedAlpha > 0.55
        ? "#17131d"
        : "#ffffff",
    label:
      outsideStandardRange
        ? `${label} · HDR preview clamped`
        : clampedAlpha < 1
          ? `${label} · Alpha ${clampedAlpha.toFixed(3)}`
          : label,
    custom: false
  };
}

function colorXPreview(
  expression
) {
  const value =
    String(expression)
      .trim();

  const named =
    value.match(
      /^colorX\.([A-Za-z_][A-Za-z0-9_]*)$/
    );

  if (
    named &&
    COLORX_NAMED_PREVIEWS[named[1]]
  ) {
    const preview =
      COLORX_NAMED_PREVIEWS[named[1]];

    return colorChannelsToPreview(
      preview.channels,
      preview.label
    );
  }

  const number =
    "([+-]?(?:(?:\\d+(?:\\.\\d*)?)|(?:\\.\\d+))(?:[eE][+-]?\\d+)?)[fFdD]?";

  const constructor =
    value.match(
      new RegExp(
        `^(?:new\\s+colorX|\\(\\s*colorX\\s*\\)\\s*new\\s+color)\\s*\\(\\s*${number}\\s*,\\s*${number}\\s*,\\s*${number}(?:\\s*,\\s*${number})?\\s*\\)$`
      )
    );

  if (constructor) {
    const channels = [
      Number(constructor[1]),
      Number(constructor[2]),
      Number(constructor[3]),
      constructor[4] === undefined
        ? 1
        : Number(constructor[4])
    ];

    if (
      channels.every(
        Number.isFinite
      )
    ) {
      return colorChannelsToPreview(
        channels,
        "Custom colorX"
      );
    }
  }

  return {
    channels: null,
    hex: "#7f7f7f",
    cssColor:
      "rgba(127, 127, 127, 1)",
    textColor:
      "#ffffff",
    label:
      "Custom C# expression",
    custom: true
  };
}

function portableColorXExpression(
  expression
) {
  const value =
    String(expression)
      .trim();
  const number =
    "([+-]?(?:(?:\\d+(?:\\.\\d*)?)|(?:\\.\\d+))(?:[eE][+-]?\\d+)?)[fFdD]?";
  const constructor =
    value.match(
      new RegExp(
        `^new\\s+colorX\\s*\\(\\s*${number}\\s*,\\s*${number}\\s*,\\s*${number}(?:\\s*,\\s*${number})?\\s*\\)$`
      )
    );

  if (!constructor) {
    return value ||
      "colorX.White";
  }

  const floatLiteral =
    channel =>
      `${String(channel)
        .replace(/[fFdD]$/, "")}f`;

  return (
    "(colorX)new color(" +
    `${floatLiteral(constructor[1])}, ` +
    `${floatLiteral(constructor[2])}, ` +
    `${floatLiteral(constructor[3])}, ` +
    `${floatLiteral(
      constructor[4] === undefined
        ? "1"
        : constructor[4]
    )})`
  );
}

function colorChannelLiteral(
  byteValue
) {
  if (byteValue === 0) {
    return "0f";
  }

  if (byteValue === 255) {
    return "1f";
  }

  return `${(byteValue / 255)
    .toFixed(6)
    .replace(/0+$/, "")
    .replace(/\.$/, "")}f`;
}

function colorExpressionWithAlpha(
  expression,
  alphaByte
) {
  const value =
    String(expression)
      .trim();
  const alphaLiteral =
    colorChannelLiteral(
      alphaByte
    );
  const named =
    value.match(
      /^colorX\.([A-Za-z_][A-Za-z0-9_]*)$/
    );

  if (
    named &&
    COLORX_NAMED_PREVIEWS[named[1]]
  ) {
    const [red, green, blue] =
      COLORX_NAMED_PREVIEWS[
        named[1]
      ].channels;

    return (
      "(colorX)new color(" +
      `${numberColorLiteral(red)}, ` +
      `${numberColorLiteral(green)}, ` +
      `${numberColorLiteral(blue)}, ` +
      `${alphaLiteral})`
    );
  }

  const number =
    "([+-]?(?:(?:\\d+(?:\\.\\d*)?)|(?:\\.\\d+))(?:[eE][+-]?\\d+)?)[fFdD]?";
  const constructor =
    value.match(
      new RegExp(
        `^(?:new\\s+colorX|\\(\\s*colorX\\s*\\)\\s*new\\s+color)\\s*\\(\\s*${number}\\s*,\\s*${number}\\s*,\\s*${number}(?:\\s*,\\s*${number})?\\s*\\)$`
      )
    );

  if (!constructor) {
    return value;
  }

  return (
    "(colorX)new color(" +
    `${numberColorLiteral(constructor[1])}, ` +
    `${numberColorLiteral(constructor[2])}, ` +
    `${numberColorLiteral(constructor[3])}, ` +
    `${alphaLiteral})`
  );
}

function numberColorLiteral(
  value
) {
  const normalized =
    String(value)
      .replace(/[fFdD]$/, "");

  return `${normalized}f`;
}

function colorHexExpression(
  hex,
  alphaByte = 255
) {
  const normalized =
    String(hex)
      .replace(/^#/, "")
      .padEnd(6, "0")
      .slice(0, 6);

  const red =
    Number.parseInt(
      normalized.slice(0, 2),
      16
    );
  const green =
    Number.parseInt(
      normalized.slice(2, 4),
      16
    );
  const blue =
    Number.parseInt(
      normalized.slice(4, 6),
      16
    );

  return (
    "(colorX)new color(" +
    `${colorChannelLiteral(red)}, ` +
    `${colorChannelLiteral(green)}, ` +
    `${colorChannelLiteral(blue)}, ` +
    `${colorChannelLiteral(
      alphaByte
    )})`
  );
}

function defaultForType(type) {
  switch (type) {
    case "bool":
      return "true";
    case "string":
      return "Example";
    case "Uri":
      return "https://example.com";
    case "int":
    case "float":
    case "double":
      return "0";
    case "int2":
    case "float2":
    case "double2":
      return "0, 0";
    case "int3":
    case "float3":
    case "double3":
      return "0, 0, 0";
    case "int4":
    case "float4":
    case "double4":
      return "0, 0, 0, 0";
    case "colorX":
      return "colorX.White";
    case "enum":
      return "Medium";
    default:
      return "";
  }
}

function friendlyTypeName(type) {
  return TYPE_DEFINITIONS.find(item => item.type === type)?.label || type;
}

function flattenNodes(nodes, conditions = [], path = []) {
  const entries = [];
  for (const node of nodes) {
    entries.push({ node, conditions, path });
    if (node.kind === "controller") {
      for (const option of node.options) {
        entries.push(
          ...flattenNodes(
            option.children,
            [...conditions, { controller: node, option }],
            [...path, option.name]
          )
        );
      }
    }
  }
  return entries;
}

function findNode(nodes, id) {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.kind === "controller") {
      for (const option of node.options) {
        const found = findNode(option.children, id);
        if (found) return found;
      }
    }
  }
  return null;
}

function findNodeContainerId(
  nodes,
  nodeId,
  currentContainerId = ROOT_CONTAINER
) {
  for (const node of nodes) {
    if (node.id === nodeId) {
      return currentContainerId;
    }

    if (node.kind !== "controller") {
      continue;
    }

    for (const option of node.options) {
      const containerId = findNodeContainerId(
        option.children,
        nodeId,
        option.id
      );

      if (containerId !== null) {
        return containerId;
      }
    }
  }

  return null;
}

function updateNode(nodes, id, updater) {
  return nodes.map(node => {
    if (node.id === id) return updater(node);
    if (node.kind !== "controller") return node;
    return {
      ...node,
      options: node.options.map(option => ({
        ...option,
        children: updateNode(option.children, id, updater)
      }))
    };
  });
}

function removeNode(nodes, id) {
  let removed = null;
  const next = [];
  for (const node of nodes) {
    if (node.id === id) {
      removed = node;
      continue;
    }
    if (node.kind === "controller") {
      const options = node.options.map(option => {
        const result = removeNode(option.children, id);
        if (result.removed && !removed) removed = result.removed;
        return { ...option, children: result.nodes };
      });
      next.push({ ...node, options });
    } else {
      next.push(node);
    }
  }
  return { nodes: next, removed };
}

function insertIntoContainer(nodes, containerId, nodeToInsert) {
  if (containerId === ROOT_CONTAINER) {
    return { nodes: [...nodes, nodeToInsert], inserted: true };
  }
  let inserted = false;
  const next = nodes.map(node => {
    if (node.kind !== "controller") return node;
    return {
      ...node,
      options: node.options.map(option => {
        if (option.id === containerId) {
          inserted = true;
          return { ...option, children: [...option.children, nodeToInsert] };
        }
        const nested = insertIntoContainer(
          option.children,
          containerId,
          nodeToInsert
        );
        if (nested.inserted) inserted = true;
        return { ...option, children: nested.nodes };
      })
    };
  });
  return { nodes: next, inserted };
}

function nodeContainsContainer(node, containerId) {
  if (node.kind !== "controller") return false;
  for (const option of node.options) {
    if (option.id === containerId) return true;
    if (
      option.children.some(child =>
        nodeContainsContainer(child, containerId)
      )
    ) {
      return true;
    }
  }
  return false;
}

function findContainerName(nodes, containerId) {
  if (containerId === ROOT_CONTAINER) return "Root";
  for (const node of nodes) {
    if (node.kind !== "controller") continue;
    for (const option of node.options) {
      if (option.id === containerId) {
        return `${node.fieldName} / ${option.name}`;
      }
      const nested = findContainerName(option.children, containerId);
      if (nested !== "Unknown section") return nested;
    }
  }
  return "Unknown section";
}

function makeSetting(type) {
  const count = flattenNodes(state.nodes).filter(
    entry => entry.node.kind === "setting" && entry.node.valueType === type
  ).length;
  const base =
    type === "enum"
      ? "Quality"
      : type === "Uri"
        ? "ResourceUri"
        : toPascalCase(type, "Setting");
  const fieldName = count === 0 ? base : `${base}${count + 1}`;
  return {
    id: createId("setting"),
    kind: "setting",
    valueType: type,
    fieldName,
    keyName: toSnakeCase(fieldName),
    description: `${friendlyTypeName(type)} configuration setting.`,
    defaultValue: defaultForType(type),
    hidden: false,
    validatorMode: "none",
    customValidator: "",
    useSlider: false,
    minimum: "0",
    maximum: "100",
    enumName: type === "enum" ? `${fieldName}Option` : "",
    enumOptions: type === "enum" ? ["Low", "Medium", "High"] : [],
    reaction: "stored"
  };
}

function makeController() {
  const count = flattenNodes(state.nodes).filter(
    entry => entry.node.kind === "controller"
  ).length;
  const suffix = count === 0 ? "" : `${count + 1}`;
  return {
    id: createId("controller"),
    kind: "controller",
    fieldName: `ActivePage${suffix}`,
    keyName: count === 0 ? "00_active_page" : `active_page_${count + 1}`,
    description: "Selects the visible settings section.",
    enumName: `SettingsPage${suffix}`,
    defaultOption: "General",
    reaction: "stored",
    options: [
      { id: createId("option"), name: "General", children: [] },
      { id: createId("option"), name: "Advanced", children: [] }
    ]
  };
}

function componentCount(type) {
  if (type.endsWith("2")) return 2;
  if (type.endsWith("3")) return 3;
  if (type.endsWith("4")) return 4;
  return 1;
}

function isScalarNumericType(type) {
  return ["int", "float", "double"].includes(type);
}

function isVectorType(type) {
  return /^(int|float|double)[234]$/.test(type);
}

function numericComponentType(type) {
  if (type.startsWith("int")) return "int";
  if (type.startsWith("float")) return "float";
  if (type.startsWith("double")) return "double";
  return null;
}

function supportsSlider(setting) {
  return (
    setting.kind === "setting" &&
    isScalarNumericType(setting.valueType)
  );
}

function usesSlider(setting) {
  return (
    supportsSlider(setting) &&
    (setting.useSlider ||
      setting.validatorMode === "range")
  );
}

function allowedValidatorModes(type) {
  const modes = ["none", "custom"];
  if (type === "float" || type === "double") {
    modes.push("finite");
  }
  if (isScalarNumericType(type)) {
    modes.push("range");
  }
  if (type === "Uri") {
    modes.push("absolute-uri", "http-uri");
  }
  return modes;
}

function normalizeNodes(nodes) {
  return nodes.map(node => {
    if (node.kind === "controller") {
      return {
        ...node,
        options: node.options.map(option => ({
          ...option,
          children: normalizeNodes(option.children)
        }))
      };
    }

    const validatorMode =
      allowedValidatorModes(
        node.valueType
      ).includes(node.validatorMode)
        ? node.validatorMode
        : "none";

    return {
      ...node,
      defaultValue:
        node.valueType === "colorX"
          ? portableColorXExpression(
              node.defaultValue
            )
          : node.defaultValue,
      useSlider:
        supportsSlider(node) &&
        (validatorMode === "range" ||
          Boolean(node.useSlider)),
      validatorMode
    };
  });
}

function isIntegerLiteral(value) {
  return /^[+-]?\d+$/.test(String(value).trim());
}

function isFloatLiteral(value) {
  return /^[+-]?(?:(?:\d+(?:\.\d*)?)|(?:\.\d+))(?:[eE][+-]?\d+)?[fF]?$/.test(
    String(value).trim()
  );
}

function isDoubleLiteral(value) {
  return /^[+-]?(?:(?:\d+(?:\.\d*)?)|(?:\.\d+))(?:[eE][+-]?\d+)?[dD]?$/.test(
    String(value).trim()
  );
}

function isValidNumericLiteral(value, type) {
  if (type === "int") return isIntegerLiteral(value);
  if (type === "float") return isFloatLiteral(value);
  if (type === "double") return isDoubleLiteral(value);
  return false;
}

function numericLiteralNumber(value) {
  return Number(
    String(value)
      .trim()
      .replace(/[fFdD]$/, "")
  );
}

function typedNumber(value, type) {
  const normalized = String(value).trim() || "0";
  if (type.startsWith("float") && !/[fF]$/.test(normalized)) {
    return `${normalized}f`;
  }
  if (type.startsWith("double") && !/[dD]$/.test(normalized)) {
    return `${normalized}d`;
  }
  return normalized.replace(/[fFdD]$/, "");
}

function sliderNumber(value) {
  const normalized = String(value).trim().replace(/[fFdD]$/, "") || "0";
  return `${normalized}f`;
}

function defaultExpression(setting) {
  const value = setting.defaultValue.trim();
  switch (setting.valueType) {
    case "bool":
      return value.toLowerCase() === "false" ? "false" : "true";
    case "string":
      return `"${escapeCSharp(value)}"`;
    case "Uri":
      return `new Uri(\n${" ".repeat(20)}"${escapeCSharp(
        value
      )}",\n${" ".repeat(20)}UriKind.RelativeOrAbsolute)`;
    case "int":
    case "float":
    case "double":
      return typedNumber(value, setting.valueType);
    case "int2":
    case "int3":
    case "int4":
    case "float2":
    case "float3":
    case "float4":
    case "double2":
    case "double3":
    case "double4": {
      const parts = value.split(",").map(part => part.trim());
      const count = componentCount(setting.valueType);
      while (parts.length < count) parts.push("0");
      const values = parts
        .slice(0, count)
        .map(part => typedNumber(part, setting.valueType));
      return `new ${setting.valueType}(\n${values
        .map(part => `${" ".repeat(20)}${part}`)
        .join(",\n")})`;
    }
    case "colorX":
      return portableColorXExpression(
        value
      );
    case "enum": {
      const fallback = setting.enumOptions[0] || "Value";
      return `${toPascalCase(setting.enumName, "SettingOption")}.${toPascalCase(
        value,
        fallback
      )}`;
    }
    default:
      return "default";
  }
}

function validatorExpression(setting) {
  switch (setting.validatorMode) {
    case "none":
      return "null";
    case "finite": {
      const type = setting.valueType === "double" ? "double" : "float";
      return `value =>\n${" ".repeat(20)}!${type}.IsNaN(value) &&\n${" ".repeat(
        20
      )}!${type}.IsInfinity(value)`;
    }
    case "range": {
      const minimum = typedNumber(setting.minimum, setting.valueType);
      const maximum = typedNumber(setting.maximum, setting.valueType);
      const finite =
        setting.valueType === "float" || setting.valueType === "double"
          ? `!${setting.valueType}.IsNaN(value) &&\n${" ".repeat(
              20
            )}!${setting.valueType}.IsInfinity(value) &&\n${" ".repeat(20)}`
          : "";
      return `value =>\n${" ".repeat(
        20
      )}${finite}value >= ${minimum} &&\n${" ".repeat(
        20
      )}value <= ${maximum}`;
    }
    case "absolute-uri":
      return `value =>\n${" ".repeat(20)}value != null &&\n${" ".repeat(
        20
      )}value.IsAbsoluteUri`;
    case "http-uri":
      return `value =>\n${" ".repeat(20)}value != null &&\n${" ".repeat(
        20
      )}value.IsAbsoluteUri &&\n${" ".repeat(
        20
      )}(value.Scheme == Uri.UriSchemeHttp ||\n${" ".repeat(
        21
      )}value.Scheme == Uri.UriSchemeHttps)`;
    case "custom":
      return setting.customValidator.trim() || "null";
    default:
      return "null";
  }
}

function hasOptionalArguments(setting) {
  const useSlider =
    usesSlider(setting);

  return (
    setting.hidden ||
    setting.validatorMode !== "none" ||
    useSlider
  );
}

function settingDeclaration(setting, path) {
  const type =
    setting.valueType === "enum"
      ? toPascalCase(setting.enumName, "SettingOption")
      : setting.valueType;
  const field = toPascalCase(setting.fieldName, "Setting");
  const args = [
    `"${escapeCSharp(setting.keyName)}"`,
    `"${escapeCSharp(setting.description)}"`,
    `() => ${defaultExpression(setting)}`
  ];
  if (hasOptionalArguments(setting)) {
    const useSlider =
      usesSlider(setting);

    args.push(setting.hidden ? "true" : "false");
    args.push(validatorExpression(setting));
    args.push(
      useSlider
        ? sliderNumber(setting.minimum)
        : "null"
    );
    args.push(
      useSlider
        ? sliderNumber(setting.maximum)
        : "null"
    );
  }
  const pathComment =
    path.length > 0
      ? `    // ${path.join(" / ")}\n`
      : "    // Always visible\n";
  return `${pathComment}    [AutoRegisterConfigKey]
    public static readonly ModConfigurationKey<${type}>
        ${field} =
            new(
                ${args.join(",\n                ")});
`;
}

function controllerDeclaration(controller, path) {
  const field = toPascalCase(controller.fieldName, "ActivePage");
  const enumName = toPascalCase(controller.enumName, "SettingsPage");
  const defaultOption = toPascalCase(
    controller.defaultOption,
    controller.options[0]?.name || "General"
  );
  const pathComment =
    path.length > 0
      ? `    // Nested navigation: ${path.join(" / ")}\n`
      : "    // Top-level navigation\n";
  return `${pathComment}    [AutoRegisterConfigKey]
    public static readonly ModConfigurationKey<${enumName}>
        ${field} =
            new(
                "${escapeCSharp(controller.keyName)}",
                "${escapeCSharp(controller.description)}",
                () => ${enumName}.${defaultOption});
`;
}

function enumDeclarations(entries) {
  const declarations = [];
  for (const entry of entries) {
    if (entry.node.kind === "controller") {
      const enumName = toPascalCase(entry.node.enumName, "SettingsPage");
      const options = entry.node.options
        .map(option => `    ${toPascalCase(option.name, "Page")}`)
        .join(",\n");
      declarations.push(`public enum ${enumName}\n{\n${options}\n}`);
    } else if (entry.node.valueType === "enum") {
      const enumName = toPascalCase(entry.node.enumName, "SettingOption");
      const options = entry.node.enumOptions
        .map(option => `    ${toPascalCase(option, "Value")}`)
        .join(",\n");
      declarations.push(`public enum ${enumName}\n{\n${options}\n}`);
    }
  }
  return declarations.join("\n\n");
}

function conditionExpression(conditions) {
  if (conditions.length === 0) return "true";
  return conditions
    .map(({ controller, option }) => {
      const local = toCamelCase(controller.fieldName);
      const enumName = toPascalCase(controller.enumName, "SettingsPage");
      const optionName = toPascalCase(option.name, "Page");
      return `${local} ==\n                ${enumName}.${optionName}`;
    })
    .join(" &&\n            ");
}

function reactionIncludesStartup(reaction) {
  return reaction === "startup" || reaction === "startup-saved";
}

function reactionIncludesSaved(reaction) {
  return reaction === "saved" || reaction === "startup-saved";
}

function generateCode() {
  const metadata = state.metadata;
  const entries = flattenNodes(state.nodes);
  const controllers = entries.filter(entry => entry.node.kind === "controller");
  const settings = entries.filter(entry => entry.node.kind === "setting");
  const usesElements = settings.some(entry =>
    [
      "colorX",
      "int2",
      "int3",
      "int4",
      "float2",
      "float3",
      "float4",
      "double2",
      "double3",
      "double4"
    ].includes(entry.node.valueType)
  );
  const usesColorX =
    settings.some(
      entry =>
        entry.node.valueType ===
        "colorX"
    );
  const usesCustomColorProfile =
    settings.some(
      entry =>
        entry.node.valueType ===
          "colorX" &&
        /\bColorProfile\b/.test(
          entry.node.defaultValue
        )
    );
  const className = toPascalCase(metadata.className, "YourMod");
  const namespaceName =
    metadata.namespaceName
      .split(".")
      .map(part => toPascalCase(part, "Namespace"))
      .join(".") || "YourModNamespace";
  const hasControllers = controllers.length > 0;
  const runtimeEntries = entries.filter(
    entry => entry.node.reaction !== "stored"
  );
  const savedEntries = runtimeEntries.filter(entry =>
    reactionIncludesSaved(entry.node.reaction)
  );
  const startupEntries = runtimeEntries.filter(entry =>
    reactionIncludesStartup(entry.node.reaction)
  );
  const guide = metadata.includeGuide
    ? `// RML configuration template version: 1.5

/*
 * Generated by the RML Configuration Builder.
 *
 * [AutoRegisterConfigKey] is an existing standard RML feature. The builder
 * only generates its correct usage; it does not replace or redefine it.
 *
 * Numeric scalar settings use a slider when a maximum is provided.
 * Navigation enums only control RML visibility unless a runtime reaction was
 * explicitly enabled for them in the builder.
 * Whether navigation selections are persisted immediately or with Save
 * Settings is controlled globally by the user's RML Launcher preference.
 * Picker-created colors use an explicit color-to-colorX conversion and avoid
 * the ColorProfile-dependent colorX constructor.
${usesColorX
    ? ` * colorX settings add using Renderite.Shared and the generated .csproj
 * adds the matching Renderite.Shared.dll reference automatically.
`
    : ""}${usesCustomColorProfile
    ? ` * A custom ColorProfile expression additionally requires Renderite.Shared.dll.
 * The builder's generated .csproj adds that assembly reference automatically.
`
    : ""} *
 * Keep the generated Apply... methods intact. Replace only each TODO-marked
 * discard statement with a call to the mod-specific logic.
 */

`
    : "";
  const usingLines = [
    "using System;",
    usesElements ? "using Elements.Core;" : "",
    usesColorX
      ? "using Renderite.Shared;"
      : "",
    "using ResoniteModLoader;"
  ]
    .filter(Boolean)
    .join("\n");
  const enums = enumDeclarations(entries);
  const declarations = entries
    .map(entry =>
      entry.node.kind === "controller"
        ? controllerDeclaration(entry.node, entry.path)
        : settingDeclaration(entry.node, entry.path)
    )
    .join("\n");
  const interfaceSuffix = hasControllers
    ? ",\n      IModConfigurationVisibilityProvider"
    : "";

  let runtimeBlock;
  if (runtimeEntries.length > 0) {
    const startupCalls = startupEntries
      .map(
        entry =>
          `        Apply${toPascalCase(entry.node.fieldName, "Setting")}();`
      )
      .join("\n");
    const changedBranches = savedEntries
      .map(entry => {
        const field = toPascalCase(entry.node.fieldName, "Setting");
        return `        if (ReferenceEquals(
                configurationEvent.Key,
                ${field}))
        {
            Apply${field}();
            return;
        }`;
      })
      .join("\n\n");
    const applyMethods = runtimeEntries
      .map(entry => {
        const node = entry.node;
        const field = toPascalCase(node.fieldName, "Setting");
        const type =
          node.kind === "controller"
            ? toPascalCase(node.enumName, "SettingsPage")
            : node.valueType === "enum"
              ? toPascalCase(node.enumName, "SettingOption")
              : node.valueType;
        return `    private static void Apply${field}()
    {
        ${type} value =
            _configuration.GetValue(
                ${field});

        _ = value; // TODO: Replace only this line with mod-specific logic.
    }`;
      })
      .join("\n\n");
    runtimeBlock = `    private static ModConfiguration _configuration = null!;

    public override void OnEngineInit()
    {
        _configuration =
            GetConfiguration();
${savedEntries.length > 0
    ? `
        _configuration.OnThisConfigurationChanged +=
            OnConfigurationChanged;
`
    : ""}
${startupCalls || "        // Read stored values here when the mod needs them."}
    }

${savedEntries.length > 0
    ? `    private static void OnConfigurationChanged(
        ConfigurationChangedEvent configurationEvent)
    {
${changedBranches}
    }

`
    : ""}${applyMethods}
`;
  } else {
    runtimeBlock = `    public override void OnEngineInit()
    {
        /*
         * No automatic runtime reactions were selected.
         * Read configuration values here whenever the mod requires them.
         */
    }
`;
  }

  let visibilityBlock = "";
  if (hasControllers) {
    const controllerValues = controllers
      .map(entry => {
        const controller = entry.node;
        const enumName = toPascalCase(controller.enumName, "SettingsPage");
        const field = toPascalCase(controller.fieldName, "ActivePage");
        const local = toCamelCase(controller.fieldName);
        const fallback = toPascalCase(
          controller.defaultOption,
          controller.options[0]?.name || "General"
        );
        return `        ${enumName} ${local} =
            getCurrentValue(
                ${field})
            is ${enumName} current${field}
                ? current${field}
                : ${enumName}.${fallback};`;
      })
      .join("\n\n");
    const keyBranches = entries
      .map(entry => {
        const field = toPascalCase(entry.node.fieldName, "Setting");
        const expression = conditionExpression(entry.conditions);
        return `        if (ReferenceEquals(
                key,
                ${field}))
        {
            return
                ${expression};
        }`;
      })
      .join("\n\n");
    const controllerChecks = controllers
      .map(
        entry =>
          `ReferenceEquals(\n                key,\n                ${toPascalCase(
            entry.node.fieldName,
            "ActivePage"
          )})`
      )
      .join(" ||\n            ");
    visibilityBlock = `
    public bool IsConfigurationKeyVisible(
        ModConfiguration configuration,
        ModConfigurationKey key,
        Func<ModConfigurationKey, object?>
            getCurrentValue)
    {
${controllerValues}

${keyBranches}

        return false;
    }

    public bool IsConfigurationVisibilityController(
        ModConfigurationKey key)
    {
        return
            ${controllerChecks};
    }
`;
  }

  return `${guide}${usingLines}

namespace ${namespaceName};

${enums ? `${enums}\n\n` : ""}/// <summary>
/// ${metadata.description.replace(/\r\n|\r|\n/g, " ")}
/// </summary>
public sealed class ${className}
    : ResoniteMod${interfaceSuffix}
{
    public override string Name =>
        "${escapeCSharp(metadata.modName)}";

    public override string Author =>
        "${escapeCSharp(metadata.author)}";

    public override string Version =>
        "${escapeCSharp(metadata.version)}";

${declarations}
${runtimeBlock}${visibilityBlock}}
`;
}

function generateProjectFile() {
  const settings = flattenNodes(state.nodes)
    .filter(entry => entry.node.kind === "setting");
  const usesElements = settings.some(entry =>
    [
      "colorX",
      "int2",
      "int3",
      "int4",
      "float2",
      "float3",
      "float4",
      "double2",
      "double3",
      "double4"
    ].includes(entry.node.valueType)
  );
  const usesRenderiteShared = settings.some(
    entry => entry.node.valueType === "colorX"
  );
  const className = generatedBaseName();
  const namespaceName =
    state.metadata.namespaceName
      .split(".")
      .map(part => toPascalCase(part, "Namespace"))
      .join(".") ||
    "YourModNamespace";
  const resonitePath = escapeXml(
    normalizedResonitePath(
      state.exportOptions.resonitePath
    )
  );
  const optionalReferences = [
    usesElements
      ? `    <Reference Include="Elements.Core">
      <HintPath>$(ResonitePath)Elements.Core.dll</HintPath>
      <Private>False</Private>
    </Reference>`
      : "",
    usesRenderiteShared
      ? `    <Reference Include="Renderite.Shared">
      <HintPath>$(ResonitePath)Renderite.Shared.dll</HintPath>
      <Private>False</Private>
    </Reference>`
      : ""
  ]
    .filter(Boolean)
    .join("\n\n");

  return `<Project Sdk="Microsoft.NET.Sdk">
  <!--
    Current Resonite and RML 4.2/5.x use net10.0.
    Older targets require matching older Resonite and RML assemblies.
  -->
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <LangVersion>latest</LangVersion>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>

    <AssemblyName>${escapeXml(className)}</AssemblyName>
    <RootNamespace>${escapeXml(namespaceName)}</RootNamespace>

    <ResonitePath Condition="'$(ResonitePath)' == ''">${resonitePath}</ResonitePath>
    <ResonitePath>$([MSBuild]::NormalizeDirectory('$(ResonitePath)'))</ResonitePath>
  </PropertyGroup>

  <ItemGroup>
    <Reference Include="ResoniteModLoader">
      <HintPath>$(ResonitePath)Libraries/ResoniteModLoader.dll</HintPath>
      <Private>False</Private>
    </Reference>

    <Reference Include="FrooxEngine">
      <HintPath>$(ResonitePath)FrooxEngine.dll</HintPath>
      <Private>False</Private>
    </Reference>${optionalReferences ? `\n\n${optionalReferences}` : ""}
  </ItemGroup>
</Project>
`;
}

function getDiagnostics() {
  const entries = flattenNodes(state.nodes);
  const errors = [];
  const fieldNames = new Map();
  const keyNames = new Map();
  const enumNames = new Map();
  if (!state.metadata.modName.trim()) errors.push("Mod name is required.");
  if (!state.metadata.author.trim()) errors.push("Author is required.");
  for (const entry of entries) {
    const node = entry.node;
    const field = toPascalCase(node.fieldName, "Setting");
    fieldNames.set(field, (fieldNames.get(field) || 0) + 1);
    keyNames.set(node.keyName, (keyNames.get(node.keyName) || 0) + 1);
    if (!node.keyName.trim()) {
      errors.push(`${field}: configuration key is empty.`);
    }
    if (node.kind === "controller") {
      const enumName = toPascalCase(node.enumName, "SettingsPage");
      enumNames.set(enumName, (enumNames.get(enumName) || 0) + 1);
      if (node.options.length < 2) {
        errors.push(`${field}: a section enum needs at least two options.`);
      }
      if (
        !node.options.some(
          option =>
            toPascalCase(option.name) ===
            toPascalCase(node.defaultOption)
        )
      ) {
        errors.push(`${field}: select an existing default section.`);
      }
      const optionNames = new Set();
      for (const option of node.options) {
        const safeName = toPascalCase(option.name, "Page");
        if (optionNames.has(safeName)) {
          errors.push(`${field}: duplicate section name ${safeName}.`);
        }
        optionNames.add(safeName);
      }
    } else {
      const componentType =
        numericComponentType(
          node.valueType
        );

      if (
        isScalarNumericType(
          node.valueType
        ) &&
        !isValidNumericLiteral(
          node.defaultValue,
          node.valueType
        )
      ) {
        errors.push(
          `${field}: default value is not a valid ${node.valueType} literal.`
        );
      }

      if (isVectorType(node.valueType)) {
        const components =
          node.defaultValue
            .split(",")
            .map(value => value.trim());
        const expected =
          componentCount(
            node.valueType
          );

        if (
          components.length !== expected ||
          components.some(
            value =>
              !isValidNumericLiteral(
                value,
                componentType
              )
          )
        ) {
          errors.push(
            `${field}: ${node.valueType} requires exactly ${expected} valid ${componentType} values.`
          );
        }
      }

      if (
        node.valueType === "bool" &&
        !["true", "false"].includes(
          node.defaultValue
            .trim()
            .toLowerCase()
        )
      ) {
        errors.push(
          `${field}: bool must be true or false.`
        );
      }

      if (node.valueType === "enum") {
        const enumName = toPascalCase(node.enumName, "SettingOption");
        enumNames.set(enumName, (enumNames.get(enumName) || 0) + 1);
        if (node.enumOptions.length < 1) {
          errors.push(`${field}: enum needs at least one option.`);
        }
        if (
          !node.enumOptions.some(
            option =>
              toPascalCase(option) ===
              toPascalCase(
                node.defaultValue
              )
          )
        ) {
          errors.push(
            `${field}: select an existing enum default value.`
          );
        }
      }

      const usesRange =
        (supportsSlider(node) &&
          node.useSlider) ||
        node.validatorMode === "range";

      if (
        usesRange &&
        (!isValidNumericLiteral(
          node.minimum,
          node.valueType
        ) ||
          !isValidNumericLiteral(
            node.maximum,
            node.valueType
          ))
      ) {
        errors.push(
          `${field}: minimum and maximum must be valid ${node.valueType} values.`
        );
      } else if (
        usesRange &&
        numericLiteralNumber(
          node.minimum
        ) >=
          numericLiteralNumber(
            node.maximum
          )
      ) {
        errors.push(`${field}: maximum must exceed its minimum.`);
      }
      if (
        node.validatorMode === "custom" &&
        !node.customValidator.trim()
      ) {
        errors.push(`${field}: custom validator is empty.`);
      }
    }
  }
  for (const [field, count] of fieldNames) {
    if (count > 1) errors.push(`Duplicate C# field name: ${field}.`);
  }
  for (const [key, count] of keyNames) {
    if (count > 1) errors.push(`Duplicate configuration key: ${key}.`);
  }
  for (const [enumName, count] of enumNames) {
    if (count > 1) errors.push(`Duplicate enum type name: ${enumName}.`);
  }
  return errors;
}

function persist() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        metadata: state.metadata,
        exportOptions: state.exportOptions,
        nodes: state.nodes
      })
    );
  } catch (error) {
    console.warn("Could not save the local builder draft.", error);
  }
}

function restore() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      state.nodes =
        normalizeNodes(
          clone(SAMPLE_NODES)
        );
      return;
    }
    const parsed = JSON.parse(saved);
    state.metadata = { ...DEFAULT_METADATA, ...(parsed.metadata || {}) };
    const savedExportOptions =
      parsed.exportOptions || {};
    const savedResonitePath =
      savedExportOptions.resonitePath ||
      DEFAULT_EXPORT_OPTIONS.resonitePath;
    state.exportOptions = {
      ...DEFAULT_EXPORT_OPTIONS,
      ...savedExportOptions,
      platform:
        savedExportOptions.platform ||
        inferExportPlatform(
          savedResonitePath
        ),
      resonitePath:
        savedResonitePath
    };
    state.nodes = normalizeNodes(
      Array.isArray(parsed.nodes)
        ? parsed.nodes
        : clone(SAMPLE_NODES)
    );
  } catch (error) {
    console.warn("Could not restore the local builder draft.", error);
    state.metadata = { ...DEFAULT_METADATA };
    state.exportOptions = { ...DEFAULT_EXPORT_OPTIONS };
    state.nodes =
      normalizeNodes(
        clone(SAMPLE_NODES)
      );
  }
}

function optionMarkup(value, label, selectedValue) {
  return `<option value="${escapeHtml(value)}"${
    value === selectedValue ? " selected" : ""
  }>${escapeHtml(label)}</option>`;
}

function fieldMarkup(label, value, dataField, extra = "") {
  return `<label>
    ${escapeHtml(label)}
    <input value="${escapeHtml(value)}" data-field="${escapeHtml(
      dataField
    )}" ${extra}>
  </label>`;
}

function renderMetadata() {
  const mappings = {
    "mod-name": "modName",
    author: "author",
    version: "version",
    "namespace-name": "namespaceName",
    "class-name": "className",
    "mod-description": "description"
  };
  for (const [id, property] of Object.entries(mappings)) {
    const element = document.getElementById(id);
    element.value = state.metadata[property];
    element.oninput = () => {
      state.metadata[property] = element.value;
      updateGeneratedOutput();
      persist();
    };
  }
  elements.includeGuide.checked = state.metadata.includeGuide;
  elements.includeGuide.onchange = () => {
    state.metadata.includeGuide = elements.includeGuide.checked;
    updateGeneratedOutput();
    persist();
  };
}

function renderPalette() {
  const groups = ["Core", "Numbers", "Vectors", "Visual"];
  elements.paletteContent.innerHTML = groups
    .map(group => {
      const items = TYPE_DEFINITIONS.filter(item => item.group === group)
        .map(
          item => `<button
            class="palette-item"
            type="button"
            draggable="true"
            data-palette="${escapeHtml(item.type)}">
            <span>${escapeHtml(item.badge)}</span>
            <strong>${escapeHtml(item.label)}</strong>
            <b>＋</b>
          </button>`
        )
        .join("");
      return `<div class="palette-group">
        <h2>${escapeHtml(group)}</h2>
        <div class="palette-list">${items}</div>
      </div>`;
    })
    .join("");

  elements.paletteContent.querySelectorAll("[data-palette]").forEach(button => {
    button.addEventListener("click", () => {
      addPaletteItem(button.dataset.palette, state.activeContainerId);
    });
    button.addEventListener("dragstart", event => {
      beginDragScrolling(event);
      event.dataTransfer.setData(
        "application/x-rml-palette",
        button.dataset.palette
      );
      event.dataTransfer.effectAllowed = "copy";
    });
    button.addEventListener("dragend", finishDragInteraction);
  });
}

function addPaletteItem(type, containerId) {
  const node = type === "controller" ? makeController() : makeSetting(type);
  const result = insertIntoContainer(state.nodes, containerId, node);
  if (!result.inserted) {
    state.activeContainerId = ROOT_CONTAINER;
    state.nodes = [...state.nodes, node];
  } else {
    state.nodes = result.nodes;
  }
  state.selectedId = node.id;
  renderAll();
}

function selectedBadge(node) {
  if (node.kind === "controller") return "§";
  return (
    TYPE_DEFINITIONS.find(item => item.type === node.valueType)?.badge ||
    node.valueType
  );
}

function nodeCardMarkup(node) {
  const selected = state.selectedId === node.id ? " selected" : "";
  const subtitle =
    node.kind === "controller"
      ? `${node.enumName} · section navigation`
      : `${node.valueType} · ${node.keyName}`;
  let body = "";
  if (node.kind === "controller") {
    body = `<div class="controller-options">
      ${node.options
        .map(
          option => `<section
            class="option-lane${
              state.activeContainerId === option.id
                ? " active-container"
                : ""
            }${
              state.dragOverContainer === option.id
                ? " drag-over"
                : ""
            }"
            data-container="${escapeHtml(option.id)}">
            <header class="option-heading">
              <span>${escapeHtml(option.name)}</span>
              <small>${option.children.length} item${
                option.children.length === 1 ? "" : "s"
              }</small>
            </header>
            <div class="drop-zone">
              ${
                option.children.length
                  ? option.children.map(nodeCardMarkup).join("")
                  : `<div class="empty-drop"><span>＋</span>Drop or add controls here</div>`
              }
            </div>
          </section>`
        )
        .join("")}
    </div>`;
  }
  return `<article
    class="node-card ${escapeHtml(node.kind)}${selected}"
    draggable="true"
    data-node-id="${escapeHtml(node.id)}">
    <div class="node-head">
      <div class="node-icon">${escapeHtml(selectedBadge(node))}</div>
      <div class="node-copy">
        <strong>${escapeHtml(node.fieldName)}</strong>
        <small>${escapeHtml(subtitle)}</small>
      </div>
      <button
        class="delete-node"
        type="button"
        data-delete-node="${escapeHtml(node.id)}"
        title="Delete">×</button>
    </div>
    ${body}
  </article>`;
}

function allowContainerDrop(container, event) {
  event.preventDefault();
  event.stopPropagation();
  state.dragOverContainer = container;
  event.dataTransfer.dropEffect = event.dataTransfer.types.includes(
    "application/x-rml-node"
  )
    ? "move"
    : "copy";
  document.querySelectorAll(".option-lane, .builder-canvas").forEach(zone => {
    zone.classList.toggle(
      "drag-over",
      (zone.dataset.container || ROOT_CONTAINER) === container
    );
  });
}

function clearDragFeedback() {
  state.dragOverContainer = null;
  document
    .querySelectorAll(".option-lane.drag-over, .builder-canvas.drag-over")
    .forEach(zone => zone.classList.remove("drag-over"));
}

function beginDragScrolling(event) {
  dragScrollActive = true;
  dragPointerY =
    Number.isFinite(event?.clientY)
      ? event.clientY
      : null;

  if (dragScrollFrame === null) {
    dragScrollFrame =
      window.requestAnimationFrame(runDragScrolling);
  }
}

function updateDragScrolling(event) {
  if (!dragScrollActive) {
    return;
  }

  dragPointerY = event.clientY;
}

function runDragScrolling() {
  dragScrollFrame = null;

  if (!dragScrollActive) {
    return;
  }

  if (dragPointerY !== null) {
    const viewportHeight =
      window.innerHeight ||
      document.documentElement.clientHeight;

    let scrollAmount = 0;

    if (dragPointerY < DRAG_SCROLL_EDGE) {
      const intensity =
        (DRAG_SCROLL_EDGE - Math.max(0, dragPointerY)) /
        DRAG_SCROLL_EDGE;

      scrollAmount =
        -Math.ceil(
          DRAG_SCROLL_MAX_SPEED *
          intensity
        );
    } else if (
      dragPointerY >
      viewportHeight - DRAG_SCROLL_EDGE
    ) {
      const intensity =
        (
          dragPointerY -
          (viewportHeight - DRAG_SCROLL_EDGE)
        ) /
        DRAG_SCROLL_EDGE;

      scrollAmount =
        Math.ceil(
          DRAG_SCROLL_MAX_SPEED *
          Math.min(1, intensity)
        );
    }

    if (scrollAmount !== 0) {
      window.scrollBy(
        0,
        scrollAmount
      );
    }
  }

  dragScrollFrame =
    window.requestAnimationFrame(runDragScrolling);
}

function stopDragScrolling() {
  dragScrollActive = false;
  dragPointerY = null;

  if (dragScrollFrame !== null) {
    window.cancelAnimationFrame(
      dragScrollFrame
    );

    dragScrollFrame = null;
  }
}

function finishDragInteraction() {
  stopDragScrolling();
  clearDragFeedback();
}

function handleDrop(containerId, event) {
  event.preventDefault();
  event.stopPropagation();
  const paletteType = event.dataTransfer.getData(
    "application/x-rml-palette"
  );
  const nodeId = event.dataTransfer.getData("application/x-rml-node");
  finishDragInteraction();
  if (paletteType) {
    addPaletteItem(paletteType, containerId);
    return;
  }
  if (!nodeId) {
    renderAll();
    return;
  }
  const movingNode = findNode(state.nodes, nodeId);
  if (!movingNode || nodeContainsContainer(movingNode, containerId)) {
    renderAll();
    return;
  }
  const removal = removeNode(state.nodes, nodeId);
  if (!removal.removed) {
    renderAll();
    return;
  }
  const insertion = insertIntoContainer(
    removal.nodes,
    containerId,
    removal.removed
  );
  state.nodes = insertion.inserted
    ? insertion.nodes
    : [...removal.nodes, removal.removed];
  state.activeContainerId = containerId;
  state.selectedId = nodeId;
  renderAll();
}

function bindCanvasInteractions() {
  document.querySelectorAll("[data-node-id]").forEach(card => {
    card.addEventListener("click", event => {
      event.stopPropagation();
      const nodeId =
        card.dataset.nodeId;

      state.selectedId =
        nodeId;

      state.activeContainerId =
        findNodeContainerId(
          state.nodes,
          nodeId
        ) ?? ROOT_CONTAINER;

      renderAll();
    });
    card.addEventListener("dragstart", event => {
      event.stopPropagation();
      beginDragScrolling(event);
      event.dataTransfer.setData(
        "application/x-rml-node",
        card.dataset.nodeId
      );
      event.dataTransfer.effectAllowed = "move";
    });
    card.addEventListener("dragend", finishDragInteraction);
  });
  document.querySelectorAll("[data-delete-node]").forEach(button => {
    button.addEventListener("click", event => {
      event.stopPropagation();
      const id = button.dataset.deleteNode;
      const result = removeNode(state.nodes, id);
      state.nodes = result.nodes;
      if (state.selectedId === id) state.selectedId = null;
      if (
        result.removed &&
        nodeContainsContainer(result.removed, state.activeContainerId)
      ) {
        state.activeContainerId = ROOT_CONTAINER;
      }
      renderAll();
    });
  });
  document.querySelectorAll("[data-container]").forEach(zone => {
    const containerId = zone.dataset.container;
    zone.addEventListener("click", event => {
      event.stopPropagation();
      state.activeContainerId = containerId;
      renderCanvas();
    });
    zone.addEventListener("dragover", event =>
      allowContainerDrop(containerId, event)
    );
    zone.addEventListener("drop", event =>
      handleDrop(containerId, event)
    );
    zone.addEventListener("dragleave", event => {
      if (!zone.contains(event.relatedTarget)) {
        zone.classList.remove("drag-over");

        if (
          state.dragOverContainer ===
          containerId
        ) {
          state.dragOverContainer = null;
        }
      }
    });
  });
  /*
   * The root canvas survives renderCanvas(). Assigning these handlers replaces
   * the previous render's handlers instead of accumulating another set on
   * every rebuild. Nested zones and cards are recreated with innerHTML and can
   * safely use addEventListener above.
   */
  elements.builderCanvas.onclick = () => {
    state.activeContainerId = ROOT_CONTAINER;
    elements.activeContainerName.textContent = "Root";
  };
  elements.builderCanvas.ondragover = event => {
    if (!event.target.closest("[data-container]")) {
      allowContainerDrop(ROOT_CONTAINER, event);
    }
  };
  elements.builderCanvas.ondrop = event => {
    if (!event.target.closest("[data-container]")) {
      handleDrop(ROOT_CONTAINER, event);
    }
  };
  elements.builderCanvas.ondragleave = event => {
    if (!elements.builderCanvas.contains(event.relatedTarget)) {
      clearDragFeedback();
    }
  };
}

function renderCanvas() {
  elements.itemCount.textContent = String(flattenNodes(state.nodes).length);
  elements.activeContainerName.textContent = findContainerName(
    state.nodes,
    state.activeContainerId
  );
  elements.builderCanvas.innerHTML = state.nodes.length
    ? `${state.nodes.map(nodeCardMarkup).join("")}
       <span class="root-label">Drop on background to move to root</span>`
    : `<div class="empty-canvas">
        <span>＋</span>
        <h2>Start with a setting or section enum</h2>
        <p>Click a type in the palette or drag it into this canvas.</p>
      </div>`;
  bindCanvasInteractions();
}

function validatorChoices(node) {
  const choices = [{ value: "none", label: "No custom validation" }];
  if (node.valueType === "float" || node.valueType === "double") {
    choices.push({ value: "finite", label: "Reject NaN and Infinity" });
  }
  if (["int", "float", "double"].includes(node.valueType)) {
    choices.push({ value: "range", label: "Require numeric range" });
  }
  if (node.valueType === "Uri") {
    choices.push({ value: "absolute-uri", label: "Require absolute URI" });
    choices.push({ value: "http-uri", label: "Only HTTP / HTTPS" });
  }
  choices.push({ value: "custom", label: "Custom C# predicate" });
  return choices;
}

function reactionSelectMarkup(value) {
  return `<label>
    Runtime behavior
    <select data-field="reaction">
      ${optionMarkup(
        "stored",
        "Stored only — no generated mod reaction",
        value
      )}
      ${optionMarkup("startup", "Apply at mod startup", value)}
      ${optionMarkup("saved", "Apply after saved changes", value)}
      ${optionMarkup(
        "startup-saved",
        "Apply at startup and after saved changes",
        value
      )}
    </select>
    <small>Section enums normally stay “Stored only”; RML already handles their navigation.</small>
  </label>`;
}

function numericFieldMarkup(
  label,
  value,
  dataField,
  numericType
) {
  const step =
    numericType === "int"
      ? "1"
      : "any";
  const inputMode =
    numericType === "int"
      ? "numeric"
      : "decimal";

  return `<label>
    ${escapeHtml(label)}
    <input
      type="number"
      step="${step}"
      inputmode="${inputMode}"
      value="${escapeHtml(
        numericInputValue(value)
      )}"
      data-field="${escapeHtml(
        dataField
      )}">
  </label>`;
}

function vectorComponentFieldMarkup(
  label,
  value,
  index,
  numericType
) {
  const step =
    numericType === "int"
      ? "1"
      : "any";
  const inputMode =
    numericType === "int"
      ? "numeric"
      : "decimal";

  return `<label class="vector-component">
    ${escapeHtml(label)}
    <input
      type="number"
      step="${step}"
      inputmode="${inputMode}"
      value="${escapeHtml(
        numericInputValue(value)
      )}"
      data-vector-index="${index}"
      aria-label="${escapeHtml(
        `${label} component`
      )}">
  </label>`;
}

function vectorDefaultValueMarkup(
  node
) {
  const componentType =
    numericComponentType(
      node.valueType
    );
  const count =
    componentCount(
      node.valueType
    );
  const values =
    vectorComponentValues(
      node.defaultValue,
      count
    );

  return `<fieldset class="vector-default-editor">
    <legend>Default value</legend>
    <div class="vector-fields vector-fields-${count}">
      ${values
        .map(
          (value, index) =>
            vectorComponentFieldMarkup(
              VECTOR_COMPONENT_NAMES[index],
              value,
              index,
              componentType
            )
        )
        .join("")}
    </div>
    <small>Separate ${componentType} fields for the ${count} vector components.</small>
  </fieldset>`;
}

function colorDefaultValueMarkup(
  node
) {
  const preview =
    colorXPreview(
      node.defaultValue
    );
  const alphaByte =
    preview.channels
      ? clamp(
          Math.round(
            preview.channels[3] *
              255
          ),
          0,
          255
        )
      : 255;
  const alphaPercent =
    Math.round(
      alphaByte /
        255 *
        100
    );

  return `<fieldset class="color-default-editor">
    <legend>Default color</legend>
    <label class="color-picker-control">
      Color picker
      <span
        class="color-picker-button${
          preview.custom
            ? " custom-expression"
            : ""
        }"
        data-color-preview
        style="--preview-color: ${escapeHtml(
          preview.cssColor
        )}; --preview-text: ${escapeHtml(
          preview.textColor
        )}">
        <strong data-color-preview-label>${escapeHtml(
          preview.label
        )}</strong>
        <small>Click anywhere to choose a color</small>
        <input
          type="color"
          value="${escapeHtml(
            preview.hex
          )}"
          data-color-picker
          aria-label="Choose default color">
      </span>
    </label>
    <label class="color-alpha-control">
      <span class="color-alpha-heading">
        <span>Alpha</span>
        <output data-color-alpha-output>${
          preview.custom
            ? "Unavailable for custom expression"
            : `${alphaByte} · ${alphaPercent}%`
        }</output>
      </span>
      <input
        class="color-alpha-slider"
        type="range"
        min="0"
        max="255"
        step="1"
        value="${alphaByte}"
        data-color-alpha
        style="--alpha-color: ${escapeHtml(
          preview.hex
        )}"
        aria-label="Default color alpha"${
          preview.custom
            ? " disabled"
            : ""
        }>
    </label>
    <label>
      C# colorX expression
      <input
        value="${escapeHtml(
          node.defaultValue
        )}"
        data-field="defaultValue"
        autocomplete="off">
      <small>The picker writes standard RGB and the alpha slider writes opacity. Keep this field for named colors, HDR values or custom colorX expressions.</small>
    </label>
  </fieldset>`;
}

function defaultValueMarkup(node) {
  if (node.valueType === "bool") {
    const normalized =
      node.defaultValue
        .trim()
        .toLowerCase() === "false"
        ? "false"
        : "true";

    return `<label>
      Default value
      <select data-field="defaultValue">
        ${optionMarkup(
          "true",
          "true",
          normalized
        )}
        ${optionMarkup(
          "false",
          "false",
          normalized
        )}
      </select>
    </label>`;
  }

  if (node.valueType === "enum") {
    return `<label>
      Default value
      <select data-field="defaultValue">
        ${node.enumOptions
          .map(option =>
            optionMarkup(
              option,
              option,
              node.defaultValue
            )
          )
          .join("")}
      </select>
    </label>`;
  }

  if (
    isScalarNumericType(
      node.valueType
    )
  ) {
    return numericFieldMarkup(
      "Default value",
      node.defaultValue,
      "defaultValue",
      node.valueType
    );
  }

  if (isVectorType(node.valueType)) {
    return vectorDefaultValueMarkup(
      node
    );
  }

  if (node.valueType === "colorX") {
    return colorDefaultValueMarkup(
      node
    );
  }

  return fieldMarkup(
    "Default value",
    node.defaultValue,
    "defaultValue"
  );
}

function settingInspectorMarkup(node) {
  const scalarNumeric =
    isScalarNumericType(
      node.valueType
    );
  const enumFields =
    node.valueType === "enum"
      ? `<fieldset>
          <legend>Normal enum</legend>
          ${fieldMarkup("Enum type name", node.enumName, "enumName")}
          <label>
            Enum values <small>One value per line.</small>
            <textarea data-field="enumOptions">${escapeHtml(
              node.enumOptions.join("\n")
            )}</textarea>
          </label>
        </fieldset>`
      : "";
  const showRangeFields =
    scalarNumeric &&
    usesSlider(node);
  const sliderRequiredByValidator =
    node.validatorMode === "range";
  const sliderFields = scalarNumeric
    ? `<div class="toggle-row">
        <span>
          <strong>Use slider</strong>
          <small>${
            sliderRequiredByValidator
              ? "Required by the numeric range validator."
              : "A maximum enables the scalar numeric slider."
          }</small>
        </span>
        <input type="checkbox" data-field="useSlider"${
          usesSlider(node)
            ? " checked"
            : ""
        }${
          sliderRequiredByValidator
            ? " disabled"
            : ""
        }>
      </div>
      ${
        showRangeFields
          ? `<div class="split-fields">
              ${numericFieldMarkup(
                "Minimum",
                node.minimum,
                "minimum",
                node.valueType
              )}
              ${numericFieldMarkup(
                "Maximum",
                node.maximum,
                "maximum",
                node.valueType
              )}
            </div>`
          : ""
      }`
    : "";
  const validatorOptions = validatorChoices(node)
    .map(choice =>
      optionMarkup(choice.value, choice.label, node.validatorMode)
    )
    .join("");
  return `<div class="inspector-form" data-inspector-id="${escapeHtml(
    node.id
  )}">
    <div class="selection-type">
      <span>${escapeHtml(node.valueType)}</span>
      <button type="button" data-inspector-delete>Delete setting</button>
    </div>
    ${fieldMarkup("C# field name", node.fieldName, "fieldName")}
    ${fieldMarkup("Configuration key", node.keyName, "keyName")}
    <label>
      Description
      <textarea data-field="description">${escapeHtml(
        node.description
      )}</textarea>
    </label>
    ${defaultValueMarkup(node)}
    ${enumFields}
    <div class="toggle-row">
      <span>
        <strong>Internal / hidden</strong>
        <small>Stored in the config but not editable in RML.</small>
      </span>
      <input type="checkbox" data-field="hidden"${
        node.hidden ? " checked" : ""
      }>
    </div>
    ${sliderFields}
    <fieldset>
      <legend>Validity check</legend>
      <label>
        Validator
        <select data-field="validatorMode">${validatorOptions}</select>
      </label>
      ${
        node.validatorMode === "custom"
          ? `<label>
              C# predicate
              <textarea data-field="customValidator" placeholder="value => value != null">${escapeHtml(
                node.customValidator
              )}</textarea>
            </label>`
          : ""
      }
    </fieldset>
    ${reactionSelectMarkup(node.reaction)}
  </div>`;
}

function controllerInspectorMarkup(node) {
  const options = node.options
    .map(
      (option, index) => `<div class="option-editor">
        <input
          value="${escapeHtml(option.name)}"
          data-option-name="${escapeHtml(option.id)}"
          aria-label="Section ${index + 1}">
        <button
          class="remove-option"
          type="button"
          data-remove-option="${escapeHtml(option.id)}"
          ${node.options.length <= 2 ? "disabled" : ""}
          title="Remove section">×</button>
      </div>`
    )
    .join("");
  const defaults = node.options
    .map(option =>
      optionMarkup(option.name, option.name, node.defaultOption)
    )
    .join("");
  return `<div class="inspector-form" data-inspector-id="${escapeHtml(
    node.id
  )}">
    <div class="selection-type">
      <span>SECTION ENUM</span>
      <button type="button" data-inspector-delete>Delete controller</button>
    </div>
    ${fieldMarkup("C# field name", node.fieldName, "fieldName")}
    ${fieldMarkup("Configuration key", node.keyName, "keyName")}
    <label>
      Description
      <textarea data-field="description">${escapeHtml(
        node.description
      )}</textarea>
    </label>
    ${fieldMarkup("Enum type name", node.enumName, "enumName")}
    <fieldset>
      <legend>Sections / enum values</legend>
      ${options}
      <button class="add-option" type="button" data-add-option>
        ＋ Add section
      </button>
    </fieldset>
    <label>
      Default section
      <select data-field="defaultOption">${defaults}</select>
    </label>
    ${reactionSelectMarkup(node.reaction)}
  </div>`;
}

function changeSelectedNode(field, value) {
  const id = state.selectedId;
  state.nodes = updateNode(state.nodes, id, node => {
    if (
      node.kind === "setting" &&
      field === "validatorMode"
    ) {
      return {
        ...node,
        validatorMode: value,
        useSlider:
          value === "range"
            ? true
            : node.useSlider
      };
    }

    if (
      node.kind === "setting" &&
      field === "useSlider"
    ) {
      return {
        ...node,
        useSlider:
          node.validatorMode === "range"
            ? true
            : Boolean(value)
      };
    }

    if (field === "enumOptions" && node.kind === "setting") {
      return {
        ...node,
        enumOptions: value
          .split(/\r?\n/)
          .map(item => item.trim())
          .filter(Boolean)
      };
    }
    return { ...node, [field]: value };
  });
}

function updateColorPreview(
  form,
  expression
) {
  const picker =
    form.querySelector(
      "[data-color-picker]"
    );
  const previewElement =
    form.querySelector(
      "[data-color-preview]"
    );
  const alphaInput =
    form.querySelector(
      "[data-color-alpha]"
    );
  const alphaOutput =
    form.querySelector(
      "[data-color-alpha-output]"
    );

  if (
    !picker ||
    !previewElement
  ) {
    return;
  }

  const preview =
    colorXPreview(
      expression
    );

  picker.value =
    preview.hex;

  if (alphaInput) {
    alphaInput.style.setProperty(
      "--alpha-color",
      preview.hex
    );
    alphaInput.disabled =
      preview.custom;

    if (preview.channels) {
      const alphaByte =
        clamp(
          Math.round(
            preview.channels[3] *
              255
          ),
          0,
          255
        );

      alphaInput.value =
        String(alphaByte);

      if (alphaOutput) {
        alphaOutput.textContent =
          `${alphaByte} · ` +
          `${Math.round(
            alphaByte /
              255 *
              100
          )}%`;
      }
    } else if (alphaOutput) {
      alphaOutput.textContent =
        "Unavailable for custom expression";
    }
  }

  previewElement.style.setProperty(
    "--preview-color",
    preview.cssColor
  );
  previewElement.style.setProperty(
    "--preview-text",
    preview.textColor
  );

  previewElement.classList.toggle(
    "custom-expression",
    preview.custom
  );

  const label =
    previewElement.querySelector(
      "[data-color-preview-label]"
    );

  if (label) {
    label.textContent =
      preview.label;
  }
}

function updateInspectorOutput() {
  renderCanvas();
  updateGeneratedOutput();
  persist();
}

function bindInspectorInteractions() {
  const form = elements.inspectorContent.querySelector("[data-inspector-id]");
  if (!form) return;
  form.querySelectorAll("[data-field]").forEach(input => {
    const eventName =
      input.type === "checkbox" || input.tagName === "SELECT"
        ? "change"
        : "input";
    input.addEventListener(eventName, () => {
      const value = input.type === "checkbox" ? input.checked : input.value;
      changeSelectedNode(input.dataset.field, value);

      if (
        input.dataset.field ===
          "defaultValue" &&
        form.querySelector(
          "[data-color-picker]"
        )
      ) {
        updateColorPreview(
          form,
          value
        );
      }

      if (
        input.dataset.field === "useSlider" ||
        input.dataset.field === "validatorMode"
      ) {
        renderAll();
      } else {
        updateInspectorOutput();
      }
    });

    if (
      input.dataset.field ===
      "enumOptions"
    ) {
      input.addEventListener(
        "change",
        renderAll
      );
    }
  });

  const colorPicker =
    form.querySelector(
      "[data-color-picker]"
    );
  const colorAlpha =
    form.querySelector(
      "[data-color-alpha]"
    );

  colorPicker?.addEventListener(
    "input",
    () => {
      const expression =
        colorHexExpression(
          colorPicker.value,
          colorAlpha
            ? Number(
                colorAlpha.value
              )
            : 255
        );

      changeSelectedNode(
        "defaultValue",
        expression
      );

      const expressionInput =
        form.querySelector(
          '[data-field="defaultValue"]'
        );

      if (expressionInput) {
        expressionInput.value =
          expression;
      }

      updateColorPreview(
        form,
        expression
      );

      updateInspectorOutput();
    }
  );

  colorAlpha?.addEventListener(
    "input",
    () => {
      const expressionInput =
        form.querySelector(
          '[data-field="defaultValue"]'
        );

      if (!expressionInput) {
        return;
      }

      const expression =
        colorExpressionWithAlpha(
          expressionInput.value,
          Number(
            colorAlpha.value
          )
        );

      changeSelectedNode(
        "defaultValue",
        expression
      );

      expressionInput.value =
        expression;

      updateColorPreview(
        form,
        expression
      );

      updateInspectorOutput();
    }
  );

  const vectorInputs =
    Array.from(
      form.querySelectorAll(
        "[data-vector-index]"
      )
    ).sort(
      (left, right) =>
        Number(
          left.dataset.vectorIndex
        ) -
        Number(
          right.dataset.vectorIndex
        )
    );

  vectorInputs.forEach(input => {
    input.addEventListener(
      "input",
      () => {
        const defaultValue =
          vectorInputs
            .map(component =>
              component.value
            )
            .join(", ");

        changeSelectedNode(
          "defaultValue",
          defaultValue
        );

        updateInspectorOutput();
      }
    );
  });

  form.querySelector("[data-inspector-delete]")?.addEventListener(
    "click",
    () => {
      const result = removeNode(state.nodes, state.selectedId);
      state.nodes = result.nodes;
      state.selectedId = null;
      state.activeContainerId = ROOT_CONTAINER;
      renderAll();
    }
  );
  form.querySelector("[data-add-option]")?.addEventListener("click", () => {
    const node = findNode(state.nodes, state.selectedId);
    if (!node || node.kind !== "controller") return;
    let counter = node.options.length + 1;
    let name = `Section${counter}`;
    while (
      node.options.some(
        option => toPascalCase(option.name) === toPascalCase(name)
      )
    ) {
      counter += 1;
      name = `Section${counter}`;
    }
    state.nodes = updateNode(state.nodes, node.id, current => ({
      ...current,
      options: [
        ...current.options,
        { id: createId("option"), name, children: [] }
      ]
    }));
    renderAll();
  });
  form.querySelectorAll("[data-option-name]").forEach(input => {
    input.addEventListener("input", () => {
      const optionId = input.dataset.optionName;
      state.nodes = updateNode(state.nodes, state.selectedId, current => {
        if (current.kind !== "controller") return current;
        const previous = current.options.find(item => item.id === optionId);
        const nextName = input.value;
        return {
          ...current,
          defaultOption:
            previous && current.defaultOption === previous.name
              ? nextName
              : current.defaultOption,
          options: current.options.map(option =>
            option.id === optionId
              ? { ...option, name: nextName }
              : option
          )
        };
      });
      renderCanvas();
      updateGeneratedOutput();
      persist();
    });
    input.addEventListener("change", renderAll);
  });
  form.querySelectorAll("[data-remove-option]").forEach(button => {
    button.addEventListener("click", () => {
      const optionId = button.dataset.removeOption;
      state.nodes = updateNode(state.nodes, state.selectedId, current => {
        if (current.kind !== "controller" || current.options.length <= 2) {
          return current;
        }
        const nextOptions = current.options.filter(
          option => option.id !== optionId
        );
        return {
          ...current,
          options: nextOptions,
          defaultOption: nextOptions.some(
            option => option.name === current.defaultOption
          )
            ? current.defaultOption
            : nextOptions[0].name
        };
      });
      if (state.activeContainerId === optionId) {
        state.activeContainerId = ROOT_CONTAINER;
      }
      renderAll();
    });
  });
}

function renderInspector() {
  const node = state.selectedId
    ? findNode(state.nodes, state.selectedId)
    : null;
  if (!node) {
    elements.inspectorContent.innerHTML = `<div class="empty-inspector">
      <span>⌁</span>
      <h2>Select an item</h2>
      <p>Its names, defaults, validation, slider and runtime behavior appear here.</p>
    </div>`;
    return;
  }
  elements.inspectorContent.innerHTML =
    node.kind === "controller"
      ? controllerInspectorMarkup(node)
      : settingInspectorMarkup(node);
  bindInspectorInteractions();
}

function updateGeneratedOutput() {
  const errors = getDiagnostics();
  const code = generateCode();
  elements.generatedCode.textContent = code;
  elements.codeSummary.textContent = `${flattenNodes(state.nodes).length} item${
    flattenNodes(state.nodes).length === 1 ? "" : "s"
  } · ${code.split("\n").length} lines`;
  elements.diagnostics.hidden = errors.length === 0;
  elements.diagnostics.innerHTML = errors.length
    ? `<strong>Fix these issues before copying:</strong><ul>${errors
        .map(error => `<li>${escapeHtml(error)}</li>`)
        .join("")}</ul>`
    : "";
  [
    elements.copyCodeBottom,
    elements.downloadCode,
    elements.downloadCodeBottom
  ].forEach(button => {
    button.disabled = errors.length > 0;
  });
}

function renderAll() {
  if (
    state.selectedId &&
    !findNode(state.nodes, state.selectedId)
  ) {
    state.selectedId = null;
  }
  if (
    state.activeContainerId !== ROOT_CONTAINER &&
    findContainerName(state.nodes, state.activeContainerId) ===
      "Unknown section"
  ) {
    state.activeContainerId = ROOT_CONTAINER;
  }
  renderCanvas();
  renderInspector();
  updateGeneratedOutput();
  persist();
}

async function copyText(text, button) {
  const original = button.textContent;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const temporary = document.createElement("textarea");
      temporary.value = text;
      temporary.style.position = "fixed";
      temporary.style.opacity = "0";
      document.body.appendChild(temporary);
      temporary.focus();
      temporary.select();
      if (!document.execCommand("copy")) {
        throw new Error("The browser rejected the clipboard operation.");
      }
      temporary.remove();
    }
    button.textContent = "Copied";
  } catch (error) {
    console.error(error);
    button.textContent = "Copy failed";
  }
  window.setTimeout(() => {
    button.textContent = original;
  }, 1400);
}

function copyGeneratedCode(button) {
  return copyText(
    generateCode(),
    button
  );
}

function copyGeneratedProjectFile(button) {
  return copyText(
    generateProjectFile(),
    button
  );
}

function downloadBlob(blob, filename) {
  const link = document.createElement("a");
  const objectUrl = URL.createObjectURL(blob);
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

let crc32Table = null;

function getCrc32Table() {
  if (crc32Table) {
    return crc32Table;
  }

  crc32Table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value =
        (value & 1) !== 0
          ? 0xedb88320 ^ (value >>> 1)
          : value >>> 1;
    }
    crc32Table[index] = value >>> 0;
  }
  return crc32Table;
}

function crc32(bytes) {
  const table = getCrc32Table();
  let value = 0xffffffff;
  for (const byte of bytes) {
    value =
      table[(value ^ byte) & 0xff] ^
      (value >>> 8);
  }
  return (value ^ 0xffffffff) >>> 0;
}

function zipDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  return {
    time:
      (date.getHours() << 11) |
      (date.getMinutes() << 5) |
      Math.floor(date.getSeconds() / 2),
    date:
      ((year - 1980) << 9) |
      ((date.getMonth() + 1) << 5) |
      date.getDate()
  };
}

function createZipBlob(files) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  const timestamp = zipDateTime();
  let localOffset = 0;
  let centralSize = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const contentBytes = encoder.encode(file.content);
    const checksum = crc32(contentBytes);

    const localHeader = new Uint8Array(
      30 + nameBytes.length
    );
    const localView = new DataView(
      localHeader.buffer
    );
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, timestamp.time, true);
    localView.setUint16(12, timestamp.date, true);
    localView.setUint32(14, checksum, true);
    localView.setUint32(18, contentBytes.length, true);
    localView.setUint32(22, contentBytes.length, true);
    localView.setUint16(26, nameBytes.length, true);
    localView.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);

    localParts.push(
      localHeader,
      contentBytes
    );

    const centralHeader = new Uint8Array(
      46 + nameBytes.length
    );
    const centralView = new DataView(
      centralHeader.buffer
    );
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, timestamp.time, true);
    centralView.setUint16(14, timestamp.date, true);
    centralView.setUint32(16, checksum, true);
    centralView.setUint32(20, contentBytes.length, true);
    centralView.setUint32(24, contentBytes.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, localOffset, true);
    centralHeader.set(nameBytes, 46);
    centralParts.push(centralHeader);

    localOffset +=
      localHeader.length +
      contentBytes.length;
    centralSize += centralHeader.length;
  }

  const endRecord = new Uint8Array(22);
  const endView = new DataView(
    endRecord.buffer
  );
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, localOffset, true);
  endView.setUint16(20, 0, true);

  return new Blob(
    [
      ...localParts,
      ...centralParts,
      endRecord
    ],
    {
      type: "application/zip"
    }
  );
}

function updateExportDialog() {
  const baseName = generatedBaseName();
  const platform =
    elements.exportPlatform.value;
  const includeCs =
    elements.exportIncludeCs.checked;
  const includeCsproj =
    elements.exportIncludeCsproj.checked;
  const pathAvailable =
    elements.exportResonitePath.value
      .trim()
      .length > 0;
  const hasSelection =
    includeCs ||
    includeCsproj;
  const projectPathMissing =
    includeCsproj &&
    !pathAvailable;
  const hasDiagnostics =
    getDiagnostics().length > 0;

  elements.exportCsFilename.textContent =
    `${baseName}.cs`;
  elements.exportCsprojFilename.textContent =
    `${baseName}.csproj`;
  elements.exportResonitePath.setAttribute(
    "aria-invalid",
    String(projectPathMissing)
  );
  elements.exportCopyCs.disabled =
    hasDiagnostics;
  elements.exportCopyCsproj.disabled =
    hasDiagnostics ||
    !pathAvailable;
  elements.exportDownloadSelected.disabled =
    hasDiagnostics ||
    !hasSelection ||
    projectPathMissing;

  const platformNotes = {
    windows:
      "Project target: <strong>.NET 10</strong>, matching current Resonite and RML. The Windows Steam path is selected.",
    linux:
      "Project target: <strong>.NET 10</strong>, matching current Resonite and RML. The Linux preset uses the MSBuild <code>$(HOME)</code> property.",
    "linux-flatpak":
      "Project target: <strong>.NET 10</strong>, matching current Resonite and RML. The Flatpak Steam sandbox path remains editable.",
    macos:
      "The generated project itself is valid on macOS with <strong>.NET 10</strong> and matching assemblies. Resonite currently has no official macOS client distribution.",
    custom:
      "Project target: <strong>.NET 10</strong>, matching current Resonite and RML. The custom assembly path remains editable."
  };
  elements.exportCompatibilityHint.innerHTML =
    platformNotes[platform] ||
    platformNotes.custom;

  if (includeCs && includeCsproj) {
    elements.exportDownloadSelected.textContent =
      "Download ZIP";
    elements.exportDownloadHint.textContent =
      "Both selected files will be bundled into one ZIP archive.";
  } else if (includeCs) {
    elements.exportDownloadSelected.textContent =
      "Download .cs";
    elements.exportDownloadHint.textContent =
      "The generated C# source will be downloaded directly.";
  } else if (includeCsproj) {
    elements.exportDownloadSelected.textContent =
      "Download .csproj";
    elements.exportDownloadHint.textContent =
      pathAvailable
        ? "The generated project file will be downloaded directly."
        : "Enter the Resonite installation path to create the project file.";
  } else {
    elements.exportDownloadSelected.textContent =
      "Select a file";
    elements.exportDownloadHint.textContent =
      "Select at least one file to download.";
  }
}

function syncExportOptions() {
  state.exportOptions = {
    platform:
      elements.exportPlatform.value,
    resonitePath:
      elements.exportResonitePath.value,
    includeCs:
      elements.exportIncludeCs.checked,
    includeCsproj:
      elements.exportIncludeCsproj.checked
  };
  persist();
  updateExportDialog();
}

function applyExportPlatformPreset() {
  const presetPath =
    EXPORT_PLATFORM_PRESETS[
      elements.exportPlatform.value
    ];

  if (presetPath) {
    elements.exportResonitePath.value =
      presetPath;
  }

  syncExportOptions();
}

function syncEditedResonitePath() {
  const selectedPlatform =
    elements.exportPlatform.value;
  const presetPath =
    EXPORT_PLATFORM_PRESETS[
      selectedPlatform
    ];

  if (
    presetPath &&
    normalizedResonitePath(
      elements.exportResonitePath.value
    ) !==
      normalizedResonitePath(
        presetPath
      )
  ) {
    elements.exportPlatform.value =
      "custom";
  }

  syncExportOptions();
}

function openExportDialog() {
  elements.exportPlatform.value =
    state.exportOptions.platform ||
    inferExportPlatform(
      state.exportOptions.resonitePath
    );
  elements.exportResonitePath.value =
    state.exportOptions.resonitePath;
  elements.exportIncludeCs.checked =
    Boolean(state.exportOptions.includeCs);
  elements.exportIncludeCsproj.checked =
    Boolean(state.exportOptions.includeCsproj);
  updateExportDialog();

  if (typeof elements.exportDialog.showModal === "function") {
    elements.exportDialog.showModal();
  } else {
    elements.exportDialog.setAttribute("open", "");
  }
}

function closeExportDialog() {
  if (typeof elements.exportDialog.close === "function") {
    elements.exportDialog.close();
  } else {
    elements.exportDialog.removeAttribute("open");
  }
}

function downloadSelectedExport() {
  syncExportOptions();
  if (elements.exportDownloadSelected.disabled) {
    return;
  }

  const baseName = generatedBaseName();
  const includeCs =
    state.exportOptions.includeCs;
  const includeCsproj =
    state.exportOptions.includeCsproj;

  if (includeCs && includeCsproj) {
    downloadBlob(
      createZipBlob([
        {
          name: `${baseName}.cs`,
          content: generateCode()
        },
        {
          name: `${baseName}.csproj`,
          content: generateProjectFile()
        }
      ]),
      `${baseName}-RML-Project.zip`
    );
  } else if (includeCs) {
    downloadBlob(
      new Blob(
        [generateCode()],
        {
          type: "text/plain;charset=utf-8"
        }
      ),
      `${baseName}.cs`
    );
  } else if (includeCsproj) {
    downloadBlob(
      new Blob(
        [generateProjectFile()],
        {
          type: "application/xml;charset=utf-8"
        }
      ),
      `${baseName}.csproj`
    );
  }
}

function loadExample() {
  state.metadata = { ...DEFAULT_METADATA };
  state.nodes =
    normalizeNodes(
      clone(SAMPLE_NODES)
    );
  state.selectedId = "controller-main";
  state.activeContainerId = ROOT_CONTAINER;
  renderMetadata();
  renderAll();
}

function newBlank() {
  if (
    state.nodes.length > 0 &&
    !window.confirm("Clear the current builder draft and start blank?")
  ) {
    return;
  }
  state.metadata = { ...DEFAULT_METADATA };
  state.nodes = [];
  state.selectedId = null;
  state.activeContainerId = ROOT_CONTAINER;
  renderMetadata();
  renderAll();
}

function cacheElements() {
  Object.assign(elements, {
    paletteContent: document.getElementById("palette-content"),
    itemCount: document.getElementById("item-count"),
    builderCanvas: document.getElementById("builder-canvas"),
    activeContainerName: document.getElementById("active-container-name"),
    inspectorContent: document.getElementById("inspector-content"),
    includeGuide: document.getElementById("include-guide"),
    generatedCode: document.getElementById("generated-code"),
    diagnostics: document.getElementById("diagnostics"),
    codeSummary: document.getElementById("code-summary"),
    copyCodeBottom: document.getElementById("copy-code-bottom"),
    downloadCode: document.getElementById("download-code"),
    downloadCodeBottom: document.getElementById("download-code-bottom"),
    exportDialog: document.getElementById("export-dialog"),
    exportClose: document.getElementById("export-close"),
    exportCancel: document.getElementById("export-cancel"),
    exportPlatform: document.getElementById("export-platform"),
    exportResonitePath: document.getElementById(
      "export-resonite-path"
    ),
    exportCompatibilityHint: document.getElementById(
      "export-compatibility-hint"
    ),
    exportIncludeCs: document.getElementById("export-include-cs"),
    exportIncludeCsproj: document.getElementById(
      "export-include-csproj"
    ),
    exportCsFilename: document.getElementById("export-cs-filename"),
    exportCsprojFilename: document.getElementById(
      "export-csproj-filename"
    ),
    exportDownloadHint: document.getElementById(
      "export-download-hint"
    ),
    exportCopyCs: document.getElementById("export-copy-cs"),
    exportCopyCsproj: document.getElementById(
      "export-copy-csproj"
    ),
    exportDownloadSelected: document.getElementById(
      "export-download-selected"
    )
  });
}

function initialize() {
  cacheElements();
  restore();
  renderMetadata();
  renderPalette();

  const structureButton = document.querySelector(
    '[data-palette="controller"]'
  );
  structureButton.addEventListener("click", () =>
    addPaletteItem("controller", state.activeContainerId)
  );
  structureButton.addEventListener("dragstart", event => {
    beginDragScrolling(event);
    event.dataTransfer.setData(
      "application/x-rml-palette",
      "controller"
    );
    event.dataTransfer.effectAllowed = "copy";
  });
  structureButton.addEventListener("dragend", finishDragInteraction);

  document.addEventListener(
    "dragover",
    updateDragScrolling,
    true
  );

  document.addEventListener(
    "drop",
    finishDragInteraction,
    true
  );

  document.addEventListener(
    "dragend",
    finishDragInteraction,
    true
  );

  document
    .getElementById("load-example")
    .addEventListener("click", loadExample);
  document
    .getElementById("new-blank")
    .addEventListener("click", newBlank);
  elements.copyCodeBottom.addEventListener("click", () =>
    copyGeneratedCode(elements.copyCodeBottom)
  );
  elements.downloadCode.addEventListener("click", openExportDialog);
  elements.downloadCodeBottom.addEventListener(
    "click",
    openExportDialog
  );
  elements.exportClose.addEventListener("click", closeExportDialog);
  elements.exportCancel.addEventListener("click", closeExportDialog);
  elements.exportPlatform.addEventListener(
    "change",
    applyExportPlatformPreset
  );
  elements.exportResonitePath.addEventListener(
    "input",
    syncEditedResonitePath
  );
  elements.exportResonitePath.addEventListener("change", () => {
    elements.exportResonitePath.value =
      normalizedResonitePath(
        elements.exportResonitePath.value
      );
    syncEditedResonitePath();
  });
  elements.exportIncludeCs.addEventListener(
    "change",
    syncExportOptions
  );
  elements.exportIncludeCsproj.addEventListener(
    "change",
    syncExportOptions
  );
  elements.exportCopyCs.addEventListener("click", () =>
    copyGeneratedCode(elements.exportCopyCs)
  );
  elements.exportCopyCsproj.addEventListener("click", () => {
    syncExportOptions();
    copyGeneratedProjectFile(
      elements.exportCopyCsproj
    );
  });
  elements.exportDownloadSelected.addEventListener(
    "click",
    downloadSelectedExport
  );
  elements.exportDialog.addEventListener("click", event => {
    if (event.target === elements.exportDialog) {
      closeExportDialog();
    }
  });

  renderAll();
}

document.addEventListener("DOMContentLoaded", initialize);
