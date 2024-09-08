+++
title = "Hyprland 下的多顯示器設定"
tags = ["Hyprland", "Linux", "桌面环境"]
date = "2024-09-08"
update = "2024-09-08"
enableGitalk = true
+++

### 前言
前段時間需要離開學校使用電腦工作，在學校的顯示器尺寸實在太大，因此購買了一個可攜式顯示器。

在回到學校後，這個可攜式顯示器就作為了輔助顯示器使用。然而，儘管 Hyprland 支援多顯示器，其工作區 (Workspace) 切換的設定卻並不符合我的使用習慣。工作區可以在屏幕之間移動，但這需要配置額外的組合鍵。此外，當切換到另一個顯示器的工作區上時，焦點和光標也會移動到另一個工作區/顯示器上，這會讓我一時找不到焦點和光標在哪。

如果是我，我應該會為每個顯示器分配 10 個工作區。當焦點在主顯示器上時，就切換到主顯示器上的工作區。當焦點在副顯示器上時，就切換到副顯示器上的工作區。這樣的邏輯不太能單純使用 Hyprland 的設定檔實現，因此需要藉助 sh 腳本的力量來實現我們的邏輯。

### 思路
Hyprland 的每個工作區有一個工作區 ID，每個顯示器也有一個顯示器 ID。那麼我們可以為 ID 為 0 的顯示器分配 ID 為 1~10 的工作區，為 ID 為 1 的顯示器分配 ID 為 11~20 的工作區，以此類推。在按下組合鍵時，檢測焦點在哪個顯示器上，然後切換到對應的工作區。

### Hyprland Dispatcher
Hyprland 有一系列的內建操作，例如切換工作區、移動工作區、移動窗口、執行指令等。這些操作可以透過 Hyprland 設定檔中配置組合鍵執行：
```ini
bind = $mainMod, 1, workspace, 1
# 當按下 mod + 1 時，切換到 1 號工作區
bind = $mainMod SHIFT 1, movetoworkspace, 1
# 當按下 mod + Shift + 1 時，將當前視窗移動到 1 號工作區，並切換到 1 號工作區
bind = $mainMod SHIFT, comma, movecurrentworkspacetomonitor, l
# 當按下 mod + Shift + "," 時，將當前工作區移動到左邊的顯示器上
bind = $mainMod T, exec, alacritty
# 當按下 mod + T 時，執行 alacritty 指令，啟動 Alacritty 終端模擬器
```

也可以透過 `hyprctl dispatch` 指令執行：

```shell
hyprctl dispatch workspace 1
hyprctl dispatch movetoworkspace 1
hyprctl dispatch movecurrentworkspacetomonitor l
hyprctl dispatch exec alacritty
```

那麼，可以讓切換工作區的組合鍵按下後執行一個 sh 腳本，在這個腳本中獲取焦點所在的顯示器，並將工作區切換到指定的顯示器上。

## sh 腳本
### 檢測焦點所在的顯示器
`hyprctl` 提供了子指令 `hyprctl activeworkspace`，可以用於獲取當前活躍工作區的狀態。在終端中執行這個指令可以得到類似如下的輸出：

```plain
workspace ID 2 (2) on monitor DP-1:
	monitorID: 0
	windows: 4
	hasfullscreen: 0
	lastwindow: 0x627422603b10
	lastwindowtitle: hyprctl activeworksp ~
```

不難從第 2 行看出，當前活躍的工作區所屬的顯示器 ID 為 0。透過 `grep` 和 `awk` 即可將數字部分提取出來：

```bash
hyprctl activeworkspace | grep "monitorID" | awk '{print $2}'
```

其中，`grep` 將會從 `hyprctl activeworkspace` 的輸出中提取出包含 `monitorID` 的這一行。而 `awk` 將會提取出用空格分割的第 2 個字串，也就是 `0`。

在 sh 腳本中，將將輸出保存為一個變量：

```bash
monitor_id=$(hyprctl activeworkspace | grep "monitorID" | awk '{print $2}')
```

### 參數設計
如你所見，這個腳本也需要一些輸入參數，例如要切換到哪個工作區，以及是否需要將當前活動的視窗也移動到那個工作區。在 sh 腳本中，可以透過 `$` 加上參數編號來獲取執行腳本時的參數。

在這裡，考慮將腳本的第 1 個參數作為操作類型，將第 2 個參數作為我們為工作區。

```bash
operation=$1
workspace=$2
```

當 `operation` 為 `switch` 時，則切換到目標工作區；當為 `move` 時，則將當前視窗移動到目標工作區，然後切換到目標工作區。

### 操作工作區
首先當然是計算目標工作區 ID。知道了顯示器 ID 和工作區編號參數之後，在 sh 腳本中計算目標工作區 ID：

```bash
$workspace_id=$(($monitor_id * 10 + $workspace))
```

然後根據操作類型，透過 `hyprctl` 來執行對應的操作：

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

您可能會注意到，在執行切換或移動工作區的操作前，還會首先將目標工作區移動到焦點所在的顯示器上。這是因為目標工作區可能並不在焦點所在的顯示器上，因此需要首先將其移動到焦點所在的顯示器上。

### 最終的腳本
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

在接下來的操作中，我將這個腳本保存為 `~/.config/hypr/switch_workspace.sh` 這一檔案。

## Hyprland 配置
原本預設的配置如下：

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

現在將其修改為在按下組合鍵時，執行腳本：

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

在 Hyprland 中設定好組合鍵之後，所有工作就完成了。

### 结语
儘管一個程式可能並不支援複雜的操作，但透過 sh 腳本，可以將不同的程式組合起來，以達成想要做到的複雜的操作。對於 Hyprland 的多顯示器設定來講，這就是一個利用 sh 腳本來將桌面環境改造得更適合個人習慣的例子。

希望這篇文章可以為您提供改造桌面環境的思路和幫助。

- - -
### 参考资料
- [Dispatchers - Hyprland Wiki](https://wiki.hyprland.org/Configuring/Dispatchers/)
- [Binds - Hyprland Wiki](https://wiki.hyprland.org/Configuring/Binds/)