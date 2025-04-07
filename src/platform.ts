import { API, DynamicPlatformPlugin, Logger, PlatformConfig, Nullable } from 'homebridge';

import { HSBConfig } from './config.js';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings.js';
import { HSBAccessory, HSBPlatformAccessory, HSBAccessoryContext, HSBDevice } from './accessory.js';
import { HSBXCallbackUrlServer } from './server/index.js';
import { HSBUtils } from './utils.js';
import { ShortcutsRunner, SSHConfig } from './shortcutsRunner';

export class HSBPlatform implements DynamicPlatformPlugin {
  public readonly config: HSBConfig;
  public readonly utils: HSBUtils;
  private readonly device: HSBDevice;
  private shortcutsRunner: ShortcutsRunner;

  public accessory: Nullable<HSBPlatformAccessory> = null;
  public server: Nullable<HSBXCallbackUrlServer> = null;

  constructor(
    public readonly log: Logger,
    _config: PlatformConfig,
    public readonly api: API,
  ) {
    if (!log.success) {
      log.success = log.info;
    }

    this.config = _config as HSBConfig;
    this.device = new HSBDevice(this.config);
    this.utils = new HSBUtils(log);

    // Configure SSH if enabled
    const sshConfig: SSHConfig | undefined = this.config.sshEnabled ? {
      enabled: true,
      host: this.config.sshHost,
      port: this.config.sshPort || 22,
      username: this.config.sshUsername,
      privateKeyPath: this.config.sshPrivateKeyPath,
      passphrase: this.config.sshPassphrase
    } : undefined;
    
    this.shortcutsRunner = new ShortcutsRunner(this.log, sshConfig);

    this.log.info('Platform initialized:', this.config.name);

    api.on('didFinishLaunching', () => {
      log.debug('Platform::api.on(didFinishLaunching) callback');

      if (this.config.callbackServerEnabled === true) {
        this.server = new HSBXCallbackUrlServer(this.config, log, this.utils, api);
      }

      this.discoverDevices();
    });
  }

  configureAccessory(accessory: HSBPlatformAccessory) {
    this.log.debug('Platform::configureAccessory', `DisplayName=${accessory.displayName}`);

    this.accessory = accessory;
  }

  discoverDevices() {
    const uuid = this.api.hap.uuid.generate(this.device.serialNumber);

    if (this.accessory?.UUID === uuid) {
      if (this.accessory.displayName !== this.device.displayName) {
        this.log.debug(
          'Platform::discoverDevices',
          'Update existing accessory display name to:',
          this.device.displayName,
        );

        this.accessory.displayName = this.device.displayName;
        this.accessory.context.device = this.device;
        this.api.updatePlatformAccessories([this.accessory]);
      }

      this.log.info(
        'Platform::discoverDevices',
        'Restored existing accessory from cache:',
        this.accessory.displayName,
      );
    } else {
      const accessory = new this.api.platformAccessory<HSBAccessoryContext>(
        this.device.displayName,
        uuid,
      );

      accessory.context.device = this.device;

      this.accessory = accessory;

      this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [this.accessory]);

      this.log.info(
        'Platform::discoverDevices',
        'Registered new accessory:',
        this.accessory.displayName,
      );
    }

    new HSBAccessory(this, this.accessory);
  }

  // Make the shortcuts runner available to accessories
  getShortcutsRunner(): ShortcutsRunner {
    return this.shortcutsRunner;
  }
}
