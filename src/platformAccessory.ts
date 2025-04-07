import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { HSBPlatform } from './platform';

export class ShortcutButtonAccessory {
  private service: Service;

  constructor(
    private readonly platform: HSBPlatform,
    private readonly accessory: PlatformAccessory,
  ) {
    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Default-Manufacturer')
      .setCharacteristic(this.platform.Characteristic.Model, 'Default-Model')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, 'Default-Serial');

    // get the Switch service if it exists, otherwise create a new Switch service
    // you can create multiple services for each accessory
    this.service = this.accessory.getService(this.platform.Service.Switch) || this.accessory.addService(this.platform.Service.Switch);

    // set the service name, this is what is displayed as the default name on the Home app
    // we are using the name we stored in the `accessory.context` in the platform class
    this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.name);

    // each service must implement at-minimum the "On" characteristic
    // see https://developers.homebridge.io/#/service/Switch
    this.service.getCharacteristic(this.platform.Characteristic.On)
      .onSet(this.setOn.bind(this));                // SET - bind to the `setOn` method to handle turning on and off

    /**
     * Creating multiple characteristics for a service
     * https://developers.homebridge.io/#/characteristic
     * 
     * this.service.getCharacteristic(this.platform.Characteristic.Brightness)
     *   .onSet(this.setBrightness.bind(this));       // SET - bind to the 'setBrightness` method to handle brightness
     */
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, turning on a Light bulb.
   */
  async setOn(value: CharacteristicValue) {
    // implement your own code to turn your device on/off
    this.platform.log.debug('Set Characteristic On ->', value);

    // Example: Access this instance's context to get the device's name
    const deviceName = this.accessory.context.device.name;
    this.platform.log.debug(`Turning ${deviceName} ${value ? 'on' : 'off'}`);

    // Example: Execute a shortcut when the switch is turned on
    if (value) {
      await this.runShortcut();
    }
  }

  async runShortcut(): Promise<void> {
    try {
      const shortcutName = this.accessory.context.device.shortcutName;
      this.platform.log.debug(`Executing shortcut: ${shortcutName}`);
      
      await this.platform.getShortcutsRunner().runShortcut(shortcutName);
      
      this.platform.log.info(`Successfully executed shortcut: ${shortcutName}`);
      // Reset button state after successful execution
      this.service.updateCharacteristic(this.platform.Characteristic.On, false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.platform.log.error(`Failed to execute shortcut: ${errorMessage}`);
      // Reset button state after failure
      this.service.updateCharacteristic(this.platform.Characteristic.On, false);
    }
  }
}