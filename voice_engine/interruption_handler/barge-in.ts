export class BargeInCoordinator {
  private interrupting = false;
  private lastInterruptAt = 0;

  async interrupt(action: () => void | Promise<void>): Promise<boolean> {
    const now = performance.now();
    if (this.interrupting || now - this.lastInterruptAt < 350) return false;
    this.interrupting = true;
    this.lastInterruptAt = now;
    try {
      await action();
      return true;
    } finally {
      this.interrupting = false;
    }
  }
}
