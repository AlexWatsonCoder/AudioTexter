// Project.ts

export enum Status {
  Pending = 1,
  Processing,
  Error,
  Done
}

export interface Task {
  id: number
  name: string
  filePath: string
  duration: number //ms
  description: string
  status: Status
  subPath?: string
  modelPath?: string
  progress: number //一个0到100之间的数值
}
