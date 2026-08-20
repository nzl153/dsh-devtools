export interface ExecResult {
  exitCode: number | null
  stdout: string
  stderr: string
  timedOut: boolean
}
