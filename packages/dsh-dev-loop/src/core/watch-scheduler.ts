// dsh-dev-loop：Watch 调度器纯逻辑 —— 防重入 + queued-latest。
// 不依赖 Node API，可单测。

export interface WatchSchedulerState {
  /** 当前是否正在执行一个由 watch 触发的 action。 */
  running: boolean
  /** 是否已积压“最新一次”变更。 */
  pending: boolean
}

/**
 * 队列策略：
 * - 同一 action 正在跑时，新的触发不重复 spawn，只把 pending 置为 true。
 * - pending 已经是 true 时再次触发不堆叠（始终只有最新一次）。
 * - 当前跑完后若 pending，则再启动一次并清空 pending。
 */
export class WatchScheduler {
  private stateInternal: WatchSchedulerState = { running: false, pending: false }

  get state(): WatchSchedulerState {
    return { ...this.stateInternal }
  }

  get running(): boolean {
    return this.stateInternal.running
  }

  get pending(): boolean {
    return this.stateInternal.pending
  }

  /**
   * 外部收到一次 debounce 后的“需要执行”信号时调用。
   * @returns true 表示这次应该立即开始执行；false 表示已有一个正在跑，本次并入 pending。
   */
  trigger(): boolean {
    if (this.stateInternal.running) {
      this.stateInternal.pending = true
      return false
    }
    this.stateInternal.running = true
    this.stateInternal.pending = false
    return true
  }

  /**
   * 当前这次执行结束时调用。
   * @returns true 表示有 pending，调用方应紧接着再启动一次；false 表示回到 idle。
   */
  finish(): boolean {
    if (this.stateInternal.pending) {
      this.stateInternal.pending = false
      return true
    }
    this.stateInternal.running = false
    return false
  }

  /** 清理状态（停止 watch 或出错时使用）。 */
  reset(): void {
    this.stateInternal = { running: false, pending: false }
  }
}