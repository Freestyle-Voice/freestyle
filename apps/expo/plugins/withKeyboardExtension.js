/**
 * Expo config plugin that adds an iOS Custom Keyboard Extension target
 * to the Xcode project during `expo prebuild`.
 *
 * This plugin:
 * 1. Copies Swift source files into the ios/ build directory
 * 2. Adds a new "FreestyleKeyboard" target to the Xcode project
 * 3. Configures App Groups for shared data between the main app and keyboard
 * 4. Sets the required entitlements and Info.plist for keyboard extensions
 * 5. Embeds the extension in the main app bundle
 */
const {
  withXcodeProject,
  withEntitlementsPlist,
  withInfoPlist,
  IOSConfig,
} = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

const KEYBOARD_EXTENSION_NAME = "FreestyleKeyboard";
const APP_GROUP_IDENTIFIER = "group.com.freestyle.app.shared";
const KEYBOARD_BUNDLE_ID_SUFFIX = ".keyboard";

function withKeyboardExtension(config) {
  // 1. Add App Group entitlement to the main app
  config = withMainAppEntitlements(config);

  // 2. Add App Group to Info.plist
  config = withMainAppInfoPlist(config);

  // 3. Add the keyboard extension target to the Xcode project
  config = withKeyboardXcodeProject(config);

  return config;
}

/**
 * Add App Groups entitlement to the main app so it can share data
 * with the keyboard extension via UserDefaults suite.
 */
function withMainAppEntitlements(config) {
  return withEntitlementsPlist(config, (mod) => {
    mod.modResults["com.apple.security.application-groups"] = [
      APP_GROUP_IDENTIFIER,
    ];
    return mod;
  });
}

/**
 * Set up the main app Info.plist
 */
function withMainAppInfoPlist(config) {
  return withInfoPlist(config, (mod) => {
    // Store the app group identifier so JS code can read it
    mod.modResults.FreestyleAppGroup = APP_GROUP_IDENTIFIER;
    return mod;
  });
}

/**
 * Add the keyboard extension target to the Xcode project.
 * This is the main config plugin logic.
 */
function withKeyboardXcodeProject(config) {
  return withXcodeProject(config, async (mod) => {
    const xcodeProject = mod.modResults;
    const projectRoot = mod.modRequest.projectRoot;
    const projectName = mod.modRequest.projectName;
    const mainBundleId = config.ios?.bundleIdentifier ?? "com.freestyle.app";
    const keyboardBundleId = mainBundleId + KEYBOARD_BUNDLE_ID_SUFFIX;

    const iosDir = path.join(projectRoot, "ios");
    const extensionDir = path.join(iosDir, KEYBOARD_EXTENSION_NAME);

    // Create the extension directory in the ios/ folder
    if (!fs.existsSync(extensionDir)) {
      fs.mkdirSync(extensionDir, { recursive: true });
    }

    // Copy Swift source files from our template directory
    const sourceDir = path.join(projectRoot, "ios-keyboard");
    const sourceFiles = [
      "KeyboardViewController.swift",
      "AudioRecorder.swift",
      "TranscriptionService.swift",
      "SharedConfig.swift",
    ];

    for (const file of sourceFiles) {
      const srcPath = path.join(sourceDir, file);
      const dstPath = path.join(extensionDir, file);
      if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, dstPath);
      }
    }

    // Write the Info.plist for the keyboard extension
    const infoPlistContent = generateKeyboardInfoPlist();
    fs.writeFileSync(path.join(extensionDir, "Info.plist"), infoPlistContent);

    // Write the entitlements file for the keyboard extension
    const entitlementsContent = generateKeyboardEntitlements();
    fs.writeFileSync(
      path.join(extensionDir, `${KEYBOARD_EXTENSION_NAME}.entitlements`),
      entitlementsContent,
    );

    // --- Add the target to the Xcode project ---

    // Check if target already exists (idempotent)
    const existingTarget = xcodeProject.pbxTargetByName(
      KEYBOARD_EXTENSION_NAME,
    );
    if (existingTarget) {
      return mod;
    }

    // Add the app extension target
    const target = xcodeProject.addTarget(
      KEYBOARD_EXTENSION_NAME,
      "app_extension",
      KEYBOARD_EXTENSION_NAME,
      keyboardBundleId,
    );

    // Add source files to the target's build phase
    const groupName = KEYBOARD_EXTENSION_NAME;
    const group = xcodeProject.addPbxGroup(
      [
        "KeyboardViewController.swift",
        "AudioRecorder.swift",
        "TranscriptionService.swift",
        "SharedConfig.swift",
        "Info.plist",
      ],
      groupName,
      KEYBOARD_EXTENSION_NAME,
    );

    // Add the group to the main project group
    const mainGroup = xcodeProject.getFirstProject().firstProject.mainGroup;
    xcodeProject.addToPbxGroup(group.uuid, mainGroup);

    // Add Swift source files to the target's compile sources build phase
    for (const file of sourceFiles) {
      xcodeProject.addSourceFile(
        `${KEYBOARD_EXTENSION_NAME}/${file}`,
        { target: target.uuid },
        group.uuid,
      );
    }

    // Configure build settings for the extension target
    const configurations = xcodeProject.pbxXCBuildConfigurationSection();
    for (const key in configurations) {
      const config = configurations[key];
      if (
        typeof config === "object" &&
        config.buildSettings &&
        config.name &&
        config.buildSettings.PRODUCT_NAME === `"${KEYBOARD_EXTENSION_NAME}"`
      ) {
        config.buildSettings.SWIFT_VERSION = "5.0";
        config.buildSettings.IPHONEOS_DEPLOYMENT_TARGET = "16.0";
        config.buildSettings.TARGETED_DEVICE_FAMILY = '"1"';
        config.buildSettings.CODE_SIGN_ENTITLEMENTS = `${KEYBOARD_EXTENSION_NAME}/${KEYBOARD_EXTENSION_NAME}.entitlements`;
        config.buildSettings.INFOPLIST_FILE = `${KEYBOARD_EXTENSION_NAME}/Info.plist`;
        config.buildSettings.PRODUCT_BUNDLE_IDENTIFIER = `"${keyboardBundleId}"`;
        config.buildSettings.GENERATE_INFOPLIST_FILE = "NO";
        config.buildSettings.CURRENT_PROJECT_VERSION = "1";
        config.buildSettings.MARKETING_VERSION = "1.0";
        config.buildSettings.CLANG_ENABLE_MODULES = "YES";
      }
    }

    // Embed the extension in the main app
    const mainTarget = xcodeProject.getFirstTarget();
    if (mainTarget) {
      xcodeProject.addBuildPhase(
        [`${KEYBOARD_EXTENSION_NAME}.appex`],
        "PBXCopyFilesBuildPhase",
        "Embed App Extensions",
        mainTarget.firstTarget.uuid,
        "app_extension",
      );
    }

    return mod;
  });
}

function generateKeyboardInfoPlist() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>$(DEVELOPMENT_LANGUAGE)</string>
  <key>CFBundleDisplayName</key>
  <string>Freestyle</string>
  <key>CFBundleExecutable</key>
  <string>$(EXECUTABLE_NAME)</string>
  <key>CFBundleIdentifier</key>
  <string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleName</key>
  <string>$(PRODUCT_NAME)</string>
  <key>CFBundlePackageType</key>
  <string>$(PRODUCT_BUNDLE_PACKAGE_TYPE)</string>
  <key>CFBundleShortVersionString</key>
  <string>$(MARKETING_VERSION)</string>
  <key>CFBundleVersion</key>
  <string>$(CURRENT_PROJECT_VERSION)</string>
  <key>NSExtension</key>
  <dict>
    <key>NSExtensionAttributes</key>
    <dict>
      <key>IsASCIICapable</key>
      <false/>
      <key>PrefersRightToLeft</key>
      <false/>
      <key>PrimaryLanguage</key>
      <string>en-US</string>
      <key>RequestsOpenAccess</key>
      <true/>
    </dict>
    <key>NSExtensionPointIdentifier</key>
    <string>com.apple.keyboard-service</string>
    <key>NSExtensionPrincipalClass</key>
    <string>$(PRODUCT_MODULE_NAME).KeyboardViewController</string>
  </dict>
  <key>NSMicrophoneUsageDescription</key>
  <string>Freestyle needs microphone access to transcribe your voice.</string>
</dict>
</plist>`;
}

function generateKeyboardEntitlements() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.application-groups</key>
  <array>
    <string>${APP_GROUP_IDENTIFIER}</string>
  </array>
</dict>
</plist>`;
}

module.exports = withKeyboardExtension;
