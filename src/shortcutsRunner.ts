import { Logger } from 'homebridge';
import { exec } from 'child_process';
import * as fs from 'fs';
import * as SSH2 from 'ssh2';

export interface SSHConfig {
  enabled: boolean;
  host: string;
  port: number;
  username: string;
  privateKeyPath: string;
  passphrase?: string;
}

export class ShortcutsRunner {
  private log: Logger;
  private sshConfig?: SSHConfig;

  constructor(log: Logger, sshConfig?: SSHConfig) {
    this.log = log;
    this.sshConfig = sshConfig;
  }

  async runShortcut(shortcutName: string): Promise<void> {
    if (this.sshConfig && this.sshConfig.enabled) {
      return this.runShortcutViaSSH(shortcutName);
    } else {
      return this.runShortcutLocally(shortcutName);
    }
  }

  private runShortcutLocally(shortcutName: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const cmd = `shortcuts run "${shortcutName}"`;
      this.log.debug(`Running local command: ${cmd}`);
      
      exec(cmd, (error, stdout, stderr) => {
        if (error) {
          this.log.error(`Error executing shortcut locally: ${error.message}`);
          this.log.debug(`stderr: ${stderr}`);
          reject(error);
          return;
        }
        
        this.log.debug(`Shortcut executed successfully: ${stdout}`);
        resolve();
      });
    });
  }

  private runShortcutViaSSH(shortcutName: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.sshConfig) {
        reject(new Error('SSH configuration is not provided'));
        return;
      }

      const { host, port, username, privateKeyPath, passphrase } = this.sshConfig;
      
      try {
        // Read private key
        const privateKey = fs.readFileSync(privateKeyPath);
        
        const conn = new SSH2.Client();
        
        conn.on('ready', () => {
          this.log.debug(`SSH connection established to ${host}`);
          const cmd = `shortcuts run "${shortcutName}"`;
          
          this.log.debug(`Running command on remote host: ${cmd}`);
          conn.exec(cmd, (err, stream) => {
            if (err) {
              conn.end();
              this.log.error(`SSH exec error: ${err.message}`);
              reject(err);
              return;
            }
            
            let stdoutData = '';
            let stderrData = '';
            
            stream.on('close', (code) => {
              conn.end();
              if (code !== 0) {
                this.log.error(`Remote command failed with code ${code}`);
                this.log.debug(`stderr: ${stderrData}`);
                reject(new Error(`Command exited with code ${code}`));
                return;
              }
              
              this.log.debug(`Remote shortcut executed successfully: ${stdoutData}`);
              resolve();
            });
            
            stream.on('data', (data) => {
              stdoutData += data.toString();
            });
            
            stream.stderr.on('data', (data) => {
              stderrData += data.toString();
            });
          });
        });
        
        conn.on('error', (err) => {
          this.log.error(`SSH connection error: ${err.message}`);
          reject(err);
        });
        
        conn.connect({
          host,
          port,
          username,
          privateKey,
          passphrase: passphrase || undefined,
        });
      } catch (error) {
        this.log.error(`Failed to establish SSH connection: ${error.message}`);
        reject(error);
      }
    });
  }
}
