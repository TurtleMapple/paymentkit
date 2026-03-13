import { env } from '../config/env';

type LogLevel = 'info' | 'success' | 'error' | 'debug' | 'warn';

const colors = {
  info: '\x1b[36m',    // Cyan
  success: '\x1b[32m', // Green
  error: '\x1b[31m',   // Red
  debug: '\x1b[35m',   // Magenta
  warn: '\x1b[33m',    // Yellow
  reset: '\x1b[0m',
};

const icons = {
  info: 'ℹ',
  success: '✓',
  error: '✗',
  debug: '⚙',
  warn: '⚠',
};

const levelWeights: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  success: 2,
  warn: 3,
  error: 4,
};

class Logger {
  private shouldLog(level: LogLevel): boolean {
    if (env.NODE_ENV === 'test') return false;
    
    const currentWeight = levelWeights[env.LOG_LEVEL as LogLevel] || 1;
    const targetWeight = levelWeights[level];
    
    return targetWeight >= currentWeight;
  }

  private format(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString();
    const color = colors[level];
    const icon = icons[level];
    const reset = colors.reset;
    
    return `${color}${icon} [${timestamp}] ${message}${reset}`;
  }

  private getTimestamp(): string {
    const now = new Date();
    if (env.NODE_ENV === 'production') {
      return now.toISOString(); // Full ISO untuk production
    }
    // Ringkas untuk development: 15:30:45
    return now.toTimeString().split(' ')[0];
  }
  

  info(message: string): void {
    if (this.shouldLog('info')) {
      console.log(this.format('info', message));
    }
  }

  success(message: string): void {
    if (this.shouldLog('success')) {
      console.log(this.format('success', message));
    }
  }

  error(message: string, error?: unknown): void {
    if (this.shouldLog('error')) {
      console.error(this.format('error', message));
      if (error && env.NODE_ENV !== 'production') {
        console.error(error);
      }
    }
  }

  debug(message: string, data?: unknown): void {
    if (this.shouldLog('debug')) {
      console.log(this.format('debug', message));
      if (data) {
        console.log(data);
      }
    }
  }

  warn(message: string): void {
    if (this.shouldLog('warn')) {
      console.warn(this.format('warn', message));
    }
  }

  separator(): void {
    console.log('━'.repeat(50));
  }
  
  banner(title: string): void {
    this.separator();
    console.log(`  ${title}`);
    this.separator();
  }
}

export const logger = new Logger();
