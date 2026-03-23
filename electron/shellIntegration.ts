// Shell integration scripts that emit OSC 133 sequences:
// OSC 133;A ST — prompt start
// OSC 133;B ST — command start (user pressed enter)
// OSC 133;C ST — command start (actual execution)
// OSC 133;D;{exitCode} ST — command end with exit code

export const BASH_INTEGRATION = `
# SunnyTerm shell integration
__sunnyterm_prompt_start() { printf '\\e]133;A\\a'; }
__sunnyterm_command_start() { printf '\\e]133;C\\a'; }
__sunnyterm_command_end() { local exit_code=$?; printf '\\e]133;D;%s\\a' "$exit_code"; return $exit_code; }
PROMPT_COMMAND="__sunnyterm_prompt_start;\${PROMPT_COMMAND:+\$PROMPT_COMMAND;} __sunnyterm_command_end"
trap '__sunnyterm_command_start' DEBUG
`

export const ZSH_INTEGRATION = `
# SunnyTerm shell integration
__sunnyterm_prompt_start() { printf '\\e]133;A\\a' }
__sunnyterm_command_start() { printf '\\e]133;C\\a' }
__sunnyterm_command_end() { printf '\\e]133;D;%s\\a' $? }
precmd_functions+=(__sunnyterm_prompt_start __sunnyterm_command_end)
preexec_functions+=(__sunnyterm_command_start)
`

export const FISH_INTEGRATION = `
# SunnyTerm shell integration
function __sunnyterm_prompt_start --on-event fish_prompt; printf '\\e]133;A\\a'; end
function __sunnyterm_command_start --on-event fish_preexec; printf '\\e]133;C\\a'; end
function __sunnyterm_command_end --on-event fish_postexec; printf '\\e]133;D;%s\\a' $status; end
`

export function getShellIntegration(shellPath: string): string | null {
  const name = shellPath.split('/').pop()?.split('.')[0]?.toLowerCase() ?? ''
  if (name === 'bash' || name === 'sh') return BASH_INTEGRATION
  if (name === 'zsh') return ZSH_INTEGRATION
  if (name === 'fish') return FISH_INTEGRATION
  return null // PowerShell, cmd — not supported yet
}
