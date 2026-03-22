const ANSI_REGEX =
  /\x1b\[[0-9;]*[a-zA-Z]|\x1b\][^\x07]*[\x07\x1b\\]|\x1b[^[\]]/g

export const stripAnsi = (s: string) => s.replace(ANSI_REGEX, '')
