+++
name = "hyprland-with-multi-monitors"
title = "Hyprland With Multiple Monitors"
tags = ["Hyprland", "Linux", "Desktop"]
date = "2024-09-08"
update = "2024-09-08"
enableGitalk = true
+++

### Foreword
Recently, I need to leave school but I still need to work on a computer. The monitor in my room was just too large. So I bought a portable monitor.

After returning to school, this portaable monitor became a secondary monitor. Although Hyprland supports multiple monitors, default monitor and workspace switching setup does not align with my habits. Workspaces can move between monitors, but this requires extra hotkey configuration. Besides, when you switch to a workspace on other monitors, focus and cursor will move to that workspace/monitor, which makes it hard for me to find the cursor at times.

I would like to allocate 10 workspaces for each monitor. When the focus is on the main monitor, it should switch to workspaces on the main monitor. When the focus is on the secondary monitor, it should switch to workspaces on the secondary monitor. Such logic doesn't seem to be implementable by hyprland configuration alone, so we need the power of shell scripts to implement our logic.

### Thought
In hyprland, each workspace has a workspace ID, and each monitor has a monitor ID. I plan to allocate workspaces with ID 1-10 to the monitor with ID 0, and workspaces with ID 11-20 to monitor with ID 1, and so on. When a shortcut key is pressed, find the focused monitor and then switch to corresponding workspace in that monitor.

### Hyprland Dispatcher
Hyprland has built in operations called dispatchers. These operations includes switching workspaces, moving workspaces, moving windows, executing commands and so on. In the configuration file, you can bind shortcut keys with these specific operations.

```ini
bind = $mainMod, 1, workspace, 1
# When mod + 1 is pressed, switch to workspace 1
bind = $mainMod SHIFT 1, movetoworkspace, 1
# When mod + Shift + 1 is pressed, move current window to workspace 1 and switch to workspace 1
bind = $mainMod SHIFT, comma, movecurrentworkspacetomonitor, l
# When mod + Shift + "," is pressed, move current workspace to the monitor on the left
bind = $mainMod T, exec, alacritty
# When mod + T is pressed, run command "alacritty", launch Alacritty terminal emulator
```

You can also run these operations by command `hyprctl dispatch`:

```shell
hyprctl dispatch workspace 1
hyprctl dispatch movetoworkspace 1
hyprctl dispatch movecurrentworkspacetomonitor l
hyprctl dispatch exec alacritty
```

So, it's possible can run a shell script when the switch workspace shortcut key is pressed. In this shell scrpt, we find the focused monitor and then switch to corresponding monitor.

## Shell Script
### Find The Focused Monitor
`hyprctl` provided subcommand `hyprctl activeworkspace`. This can be used to get details about currently active (focused) workspace. Run this command and you will get output like this:

```plain
workspace ID 2 (2) on monitor DP-1:
	monitorID: 0
	windows: 4
	hasfullscreen: 0
	lastwindow: 0x627422603b10
	lastwindowtitle: hyprctl activeworksp ~
```

From line 2, it's obvious that the currently active workspace is on monitor 0. By using `grep` and `awk`, we can extract the monitor ID.

```bash
hyprctl activeworkspace | grep "monitorID" | awk '{print $2}'
```

`grep` will extract the line that contains `monitorID`, `awk` will extract the second string splited by space, which is `0` here.

In our shell script, we store the result in a variable:

```bash
monitor_id=$(hyprctl activeworkspace | grep "monitorID" | awk '{print $2}')
```

### Script Arguments
As you can see, this script also needs some arguments, such as which workspace to switch to and whether the current active window should be move to that workspace. In shell script, you can refer to arguments by using `$` followed by the argument number.

Here, consider using the 1st argument as operation and the 2st argument as workspace number (allocated by us in current monitor, not workspace ID).

```bash
operation=$1
workspace=$2
```

When `operation` is `switch`, switch to target workspace. When `operation` is `move`, move current window to target workspace, then switch to target workspace.

### Workspace Operations
First, we need to calculate the workspace ID. Once we know monitor ID and workspace number, we calculate target workspace ID:

```bash
$workspace_id=$(($monitor_id * 10 + $workspace))
```

Then, based on operation type in arguments, we run `hyprctl` to perform corresponding operations.

```bash
if [[ $operation == "switch" ]]; then
	hyprctl dispatch moveworkspacetomonitor $workspace_id $monitor_id;
	hyprctl dispatch workspace $workspace_id;
fi
if [[ $operation == "move" ]]; then
	hyprctl dispatch moveworkspacetomonitor $workspace_id $monitor_id;
	hyprctl dispatch movetoworkspace $workspace_id;
fi
```

You may notice that before switch or move current window to target workspace, the target workspace is first moved to the focused monitor. This is because the target workspace may not be on the focused monitor at the beginning.

### Final Script
```bash
#!/bin/bash

operation=$1
workspace=$2

monitor_id=$(hyprctl activeworkspace | grep "monitorID" | awk '{print $2}')
workspace_id=$(($monitor_id * 10 + $workspace))
echo "Final Operation: $operation to $workspace_id"

if [[ $operation == "switch" ]]; then
	hyprctl dispatch moveworkspacetomonitor $workspace_id $monitor_id;
	hyprctl dispatch workspace $workspace_id;
fi
if [[ $operation == "move" ]]; then
	hyprctl dispatch moveworkspacetomonitor $workspace_id $monitor_id;
	hyprctl dispatch movetoworkspace $workspace_id;
fi

```

In the following operations, I saved this script to `~/.config/hypr/switch_workspace.sh`.

## Hyprland Configuration
The original configuration is like this:

```ini
# Switch workspaces with mainMod + [0-9]
bind = $mainMod, 1, workspace, 1
bind = $mainMod, 2, workspace, 2
# ...
bind = $mainMod, 0, workspace, 10

# Move active window to a workspace with mainMod + SHIFT + [0-9]
bind = $mainMod, 1, movetoworkspace, 1
bind = $mainMod, 2, movetoworkspace, 2
# ...
bind = $mainMod, 0, movetoworkspace, 10
```

Now we modify it to run our script when shortcut keys are pressed:

```ini
$switch_script = ~/.config/hypr/switch_workspace.sh

# Switch workspaces with mainMod + [0-9]
bind = $mainMod, 1, exec, $switch_script switch 1
bind = $mainMod, 2, exec, $switch_script switch 2
# ...
bind = $mainMod, 0, exec, $switch_script switch 10

# Move active window to a workspace with mainMod + SHIFT + [0-9]
bind = $mainMod, 1, exec, $switch_script move 1
bind = $mainMod, 2, exec, $switch_script move 2
# ...
bind = $mainMod, 0, exec, $switch_script move 10
```

After setting up shortcut keys in Hyprland, everything is done.

### Ending
One program may not support complicated operations. Through shell scripts, we can combine programs to achieve more complicated operations. In this case, it's a example of using shell scripts to make the desktop environment align with our habits.

Besides, this function can also be achieved by [`split-monitor-workspaces`](https://github.com/Duckonaut/split-monitor-workspaces), a Hyprland plugin. This plugin added dispatchers to allocate workspaces to multiple monitors, just like my implementation. I would like to use shell script, because I'm not familiar with hyprland plugins.

Hope this article can inspire you.

- - -
### Related Materials
- [Dispatchers - Hyprland Wiki](https://wiki.hyprland.org/Configuring/Dispatchers/)
- [Binds - Hyprland Wiki](https://wiki.hyprland.org/Configuring/Binds/)
