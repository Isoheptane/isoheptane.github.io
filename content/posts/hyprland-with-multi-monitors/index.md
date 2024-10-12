+++
name = "hyprland-with-multi-monitors"
title = "Hyprland 下的多显示器设置"
tags = ["Hyprland", "Linux", "桌面环境"]
date = "2024-09-08"
update = "2024-09-08"
enableGitalk = true
+++

### 前言
前段时间需要离开学校使用电脑工作，在学校的显示器尺寸实在太大，因此购买了一个可携式显示器。

在回到学校后，这个可携式显示器就作为了辅助显示器使用。然而，尽管 Hyprland 支持多显示器，其工作区 (Workspace) 切换的设置却并不符合我的使用习惯。工作区可以在屏幕之间移动，但这需要配置额外的组合键。此外，当切换到另一个显示器的工作区上时，焦点和光标也会移动到另一个工作区/显示器上，这会让我一时找不到焦点和光标在哪。

如果是我，我应该会为每个显示器分配 10 个工作区。当焦点在主显示器上时，就切换到主显示器上的工作区。当焦点在副显示器上时，就切换到副显示器上的工作区。这样的逻辑不太能单纯使用 Hyprland 的设置档实现，因此需要借助 sh 脚本的力量来实现我们的逻辑。

### 思路
Hyprland 的每个工作区有一个工作区 ID，每个显示器也有一个显示器 ID。那么我们可以为 ID 为 0 的显示器分配 ID 为 1~10 的工作区，为 ID 为 1 的显示器分配 ID 为 11~20 的工作区，以此类推。在按下组合键时，检测焦点在哪个显示器上，然后切换到对应的工作区。

### Hyprland Dispatcher
Hyprland 有一系列的内置操作，例如切换工作区、移动工作区、移动窗口、运行指令等。这些操作可以通过 Hyprland 设置档中配置组合键运行：
```ini
bind = $mainMod, 1, workspace, 1
# 当按下 mod + 1 时，切换到 1 号工作区
bind = $mainMod SHIFT 1, movetoworkspace, 1
# 当按下 mod + Shift + 1 时，将当前窗口移动到 1 号工作区，并切换到 1 号工作区
bind = $mainMod SHIFT, comma, movecurrentworkspacetomonitor, l
# 当按下 mod + Shift + "," 时，将当前工作区移动到左边的显示器上
bind = $mainMod T, exec, alacritty
# 当按下 mod + T 时，运行 alacritty 指令，启动 Alacritty 终端仿真器
```

也可以通过 `hyprctl dispatch` 指令运行：

```shell
hyprctl dispatch workspace 1
hyprctl dispatch movetoworkspace 1
hyprctl dispatch movecurrentworkspacetomonitor l
hyprctl dispatch exec alacritty
```

那么，可以让切换工作区的组合键按下后运行一个 sh 脚本，在这个脚本中获取焦点所在的显示器，并将工作区切换到指定的显示器上。

## sh 脚本
### 检测焦点所在的显示器
`hyprctl` 提供了子指令 `hyprctl activeworkspace`，可以用于获取当前活跃工作区的状态。在终端中运行这个指令可以得到类似如下的输出：

```plain
workspace ID 2 (2) on monitor DP-1:
	monitorID: 0
	windows: 4
	hasfullscreen: 0
	lastwindow: 0x627422603b10
	lastwindowtitle: hyprctl activeworksp ~
```

不难从第 2 行看出，当前活跃的工作区所属的显示器 ID 为 0。通过 `grep` 和 `awk` 即可将数字部分提取出来：

```bash
hyprctl activeworkspace | grep "monitorID" | awk '{print $2}'
```

其中，`grep` 将会从 `hyprctl activeworkspace` 的输出中提取出包含 `monitorID` 的这一行。而 `awk` 将会提取出用空格分割的第 2 个字符串，也就是 `0`。

在 sh 脚本中，将将输出保存为一个变量：

```bash
monitor_id=$(hyprctl activeworkspace | grep "monitorID" | awk '{print $2}')
```

### 参数设计
如你所见，这个脚本也需要一些输入参数，例如要切换到哪个工作区，以及是否需要将当前活动的窗口也移动到那个工作区。在 sh 脚本中，可以通过 `$` 加上参数编号来获取运行脚本时的参数。

在这里，考虑将脚本的第 1 个参数作为操作类型，将第 2 个参数作为我们为工作区。

```bash
operation=$1
workspace=$2
```

当 `operation` 为 `switch` 时，则切换到目标工作区；当为 `move` 时，则将当前窗口移动到目标工作区，然后切换到目标工作区。

### 操作工作区
首先当然是计算目标工作区 ID。知道了显示器 ID 和工作区编号参数之后，在 sh 脚本中计算目标工作区 ID：

```bash
$workspace_id=$(($monitor_id * 10 + $workspace))
```

然后根据操作类型，通过 `hyprctl` 来运行对应的操作：

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

您可能会注意到，在运行切换或移动工作区的操作前，还会首先将目标工作区移动到焦点所在的显示器上。这是因为目标工作区可能并不在焦点所在的显示器上，因此需要首先将其移动到焦点所在的显示器上。

### 最终的脚本
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

在接下来的操作中，我将这个脚本保存为 `~/.config/hypr/switch_workspace.sh` 这一文件。

## Hyprland 配置
原本缺省的配置如下：

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

现在将其修改为在按下组合键时，运行脚本：

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

在 Hyprland 中设置好组合键之后，所有工作就完成了。

### 结语
尽管一个程序可能并不支持复杂的操作，但通过 sh 脚本，可以将不同的程序组合起来，以达成想要做到的复杂的操作。对于 Hyprland 的多显示器设置来讲，这就是一个利用 sh 脚本来将桌面环境改造得更适合个人习惯的例子。

此外，本文所述的功能亦可用过 [`split-monitor-workspaces`](https://github.com/Duckonaut/split-monitor-workspaces) 插件实现，该插件添加了多个 Dispatcher，将工作区分割到多个显示器上，并在每个显示器上提供独立的编号。个人倾向于使用 sh 脚本实现，编写 Hyprland 插件对我来讲，可能会相对麻烦一些。

希望这篇文章可以为您提供改造桌面环境的思路和帮助。

- - -
### 参考资料
- [Dispatchers - Hyprland Wiki](https://wiki.hyprland.org/Configuring/Dispatchers/)
- [Binds - Hyprland Wiki](https://wiki.hyprland.org/Configuring/Binds/)
