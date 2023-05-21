+++
title = "Hyprland 环境配置与美化"
tags = ["Hyprland", "Linux", "Arch Linux", "桌面环境"]
date = "2023-05-21"
update = "2023-05-21"
enableGitalk = true
+++

{{< image hyprland_screenshot.webp >}}

### 前言
其实一直打算使用平铺式窗口管理器，但是 KDE 已经配置好了，所以也就没有太想继续折腾的动力，直到昨天 KDE 出问题了。此时我发现了 [Hyprland](https://hyprland.org/) 这样的一个看起来非常美观的 Wayland 混成器，于是我决定使用 Hyprland 来替换 KDE。  


你可以在 [Dotfiles 仓库](https://github.com/Isoheptane/dotfiles/) 中找到我正在使用的完整的配置文件。在这里我将会使用如下的搭配，并给出大致的配置。

| 类型 | 软件 |
| --- | ---- |
| Wayland 混成器 | [Hyprland](https://hyprland.org/) |
| 状态栏 | [Waybar](https://github.com/Alexays/Waybar) |
| 通知 Daemon | [mako](https://github.com/emersion/mako) |
| 应用启动器 | [tofi](https://github.com/philj56/tofi) |

## Hyprland
### 安装 Hyprland
在 Arch Linux 和 AUR 仓库中有四个版本，分别是：
- [`hyprland`](https://archlinux.org/packages/?name=hyprland)
- [`hyprland-git`](https://aur.archlinux.org/packages/hyprland-git/)
- [`hyprland-nvidia`](https://aur.archlinux.org/packages/hyprland-nvidia/)
- [`hyprland-nvidia-git`](https://aur.archlinux.org/packages/hyprland-nvidia-git/)

其中带 `nvidia` 的版本包含了对 Nvidia 显卡闪烁问题的 patch，`git` 版本则是由 GitHub 上最新的源代码进行构建的版本。由于我是 Nvidia 用户，因此在这里选择安装 `hyprland-nvidia-git`。

```shell
$ yay -S hyprland-nvidia-git
```

Hyprland 配置文件位置为：`~/.config/hypr/hyprland.conf`。如果这个文件不存在的话，创建这个文件并将[样例配置文件](https://github.com/hyprwm/Hyprland/blob/main/example/hyprland.conf)的内容复制到这个文件当中。在这之后重启 

{{< notice note >}}
如果你是 Nvidia 显卡用户，先别急着启动 Hyprland！Nvidia 显卡用户需要启用 Direct Rendering Manager 内核模式。参见 [Hyprland Wiki](https://wiki.hyprland.org/Nvidia/)。
{{</ notice >}}

### 配置 Hyprland
#### 显示器
显示器设置主要关于**显示器的分辨率、位置与缩放比例**。

显示器设置的格式如下：
```plain
monitor = monitor_name, resolution, position, scale
```

你可以通过指令 `hyprctl monitors` 来列出所有可用的显示器。

在这里，我的配置如下：
```plain
monitor=,1920x1080@60,auto,1
```

#### 输入
这一部分主要与**键盘、鼠标和触摸板的配置**有关。通常来讲默认配置也能够正常使用。
```plain
input {
    kb_layout = us              # 键盘布局
    follow_mouse = 1            # 窗口焦点是否随光标移动
    touchpad {
        natural_scroll = no     # 触摸板自然滚动
    }
    sensitivity = 0             # 鼠标灵敏度
    accel_profile = flat        # 鼠标加速的配置方案, flat 为禁用鼠标加速
}
```

由于我并不习惯鼠标加速，因此在这里将 `accel_profile` 设置为了 `flat`，禁用了鼠标加速。

#### 总体设置
这一部分主要与**窗口的布局**与**窗口边框**的设置有关。

```plain
general {
    gaps_in = 6         # 窗口之间的间隙大小
    gaps_out = 12       # 窗口与显示器边缘的间隙大小
    border_size = 2     # 窗口边框的宽度
    col.active_border = rgba(cceeffbb)      # 活动窗口的边框颜色 
    col.inactive_border = rgba(595959aa)    # 非活动窗口的边框颜色

    layout = dwindle    # 窗口布局
}
```

#### 窗口装饰
这一部分主要和窗口的**圆角、毛玻璃、投影等效果**有关。
```plain
decoration {
    rounding = 12       # 圆角大小
    blur = yes          # 模糊效果是否启用
    blur_size = 5       # 模糊半径
    blur_passes = 1     # 模糊过滤次数
    blur_new_optimizations = on     # 模糊优化，通常保持打开

    drop_shadow = yes   # 窗口投影是否启用
    shadow_range = 4    # 投影大小
    shadow_render_power = 3     # 投影强度，不过我不太明白这是什么意思
    col.shadow = rgba(1a1a1aee)     # 投影颜色
}
```

#### 动画
这一部分主要和窗口的**过渡动画**有关。
```plain
animations {
    enabled = yes   # 是否启用动画

    bezier = myBezier, 0.05, 0.9, 0.1, 1.05     # 自定义的贝塞尔曲线

    animation = windowsMove, 1, 7, myBezier             # 窗口移动动画
    animation = windowsIn, 1, 3, default, popin 90%     # 窗口打开动画
    animation = windowsOut, 1, 3, default, popin 90%    # 窗口关闭动画
    animation = border, 1, 2, default       # 边框颜色动画
    animation = fade, 1, 3, default         # 窗口各种 Fade 效果（打开、关闭、阴影、活动与非活动窗口切换）的动画
    animation = workspaces, 1, 3, default   # 工作区切换动画
}
```

动画的格式如下：
```plain
animation = action, on_off, speed, curve, style
animation = action, on_off, speed, curve
```

- `action`: 动画名称，这些动作可以在[动画树](https://wiki.hyprland.org/hyprland-wiki/pages/Configuring/Animations/#animation-tree)中找到。
- `on_off`: 是否启用动画。
- `speed`: 动画持续的时间，以分秒（100 毫秒）计数。
- `curve`: 动画使用的贝塞尔曲线名称。
- `style`: 动画的风格（例如可以对窗口使用 `fade` 和 `popin` 两种风格），这个选项是可选的。

#### 按键绑定
这里是一部分的按键绑定。

```plain
$mainMod = SUPER

bind = $mainMod, C, killactive,             # 关闭活动窗口
bind = $mainMod, T, exec, alacritty         # 打开终端模拟器 Alacritty
bind = $mainMod, M, exit,                   # 退出 Hyprland
bind = $mainMod, E, exec, nautilus          # 打开文件管理器 Nautilus
bind = $mainMod, V, togglefloating,         # 切换窗口浮动
bind = $mainMod, R, exec, tofi-drun | xargs hyprctl dispatch exec --    # 打开 tofi 应用启动器
bind = $mainMod, P, pseudo, # dwindle       # 切换伪 tiling 模式，伪 tiling 模式的窗口保持它们浮动时的大小
bind = $mainMod, J, togglesplit, # dwindle  # 切换窗口分割方向

...
```

`$mainMod` 键在此设置为了 `SUPER`，即 Super 键。通常取消 Windows 键即为 Super 键。

还有一部分关于工作区和窗口移动的按键绑定配置，在此不再展示。

## Waybar
[Waybar](https://github.com/Alexays/Waybar) 为 Wayland 提供了一个高度可定制的状态栏。

```shell
$ yay -S waybar
```

### 配置 Waybar
Waybar 拥有**两个主要的配置文件**，它们分别是：
- `~/.config/waybar/config`: 一个 JSON 文件，配置 Waybar 显示的**内容**等。
- `~/.config/waybar/style.css`: 一个 CSS 文件，配置 Waybar 的**样式**。

Waybar 的内容配置大体如下：
```json
{
    "layer": "top",     // 显示的层，top 为最顶层
    "position": "top",  // 在屏幕的哪边显示，top 为顶部
    "height": 40,       // 高度
    "spacing": 6,       // 各 module 之间的距离
    // 左边的 modules
    "modules-left": ["wlr/workspaces", "hyprland/window"],
    // 正中间的 modules
    "modules-center": [],
    // 最右边的 modules
    "modules-right": ["tray", "network", "pulseaudio", "memory", "cpu", "clock"],
    // module 各自的配置等
    "wlr/workspaces": {
        // ...
    }
    // ...
}
```

module 各自的配置详见 [Waybar GitHub Wiki](https://github.com/Alexays/Waybar/wiki)。

Waybar 的样式配置是通过一个 CSS 文件来实现的。关于 Waybar 样式的配置详见 [Styling - Waybar GitHub Wiki](https://github.com/Alexays/Waybar/wiki/Styling)。

### 设置 Waybar 自启动
向 Hyprland 的配置文件中加入这一行：
```plain
exec-once = waybar
```

重启 Hyprland 即可看到 Waybar。如果等不及重启，也可以直接执行 `waybar` 来启动 Waybar。

## mako
[mako](https://github.com/emersion/mako) 是一个为 Wayland 打造的轻量级的通知 Daemon。尽管 mako 非常轻量级，但却依然有许多可以配置的地方。

### 配置 mako
mako 的配置文件位于 `~/.config/mako/config`，内容大致如下：


```ini
sort=-time                  ; 排序方式
layer=overlay               ; 显示层级
background-color=#2e34407f  ; 背景颜色
width=420                   ; 通知宽度
height=120                  ; 通知高度
border-size=3               ; 边框宽度
border-color=#99c0d0        ; 边框颜色
border-radius=12            ; 圆角半径
icons=0                     ; 是否启用图标
max-icon-size=64            ; 图标大小
default-timeout=5000        ; 超时时间
ignore-timeout=0            ; 忽略超时时间
font="Noto Sans CJK SC" 14  ; 字体
margin=12                   ; 通知的外边距
padding=12,20               ; 通知的内边距

[urgency=low]               ; 低紧急度
border-color=#cccccc

[urgency=normal]            ; 正常紧急度
border-color=#99c0d0

[urgency=critical]          ; 高紧急度
border-color=#bf616a
default-timeout=0
```

{{< notice note >}}
以上的配置仅仅作为展示使用，**不是**一个有效的配置文件，因为其包含了注释。

你可以根据以上的内容对默认的配置文件进行修改，或从 [Dotfiles 仓库](https://github.com/Isoheptane/dotfiles/tree/main/mako) 获取我的配置文件。
{{< /notice >}}

在修改配置文件之后，用 `makoctl` 来重载配置文件：
```shell
$ makoctl reload
```

### 发送通知
你可以通过 `notify-send` 指令来发送一个通知，以此观察修改配置文件之后的效果。
```shell
$ notify-send 'Hello world!' 'This is an example notification.' -u normal
```

{{< image src=mako.webp desc="mako 配置完成后的效果" >}}

## tofi
[tofi](https://github.com/philj56/tofi) 是一个简单但快速的应用启动器。和 mako 一样，尽管十分简单，但同样也有许多可以配置的地方。

### 配置 tofi
tofi 的配置文件位于 `~/.config/tofi/config`，由于其配置文件较长，因此在这里给出部分主要的配置：
```ini
# 字体
font = "Fira Code"
font-size = 18

# 文字颜色
text-color = #FFFFFF

# 提示符样式
prompt-background = #00000000
prompt-background-padding = 0
prompt-background-corner-radius = 0

# 占位符样式
placeholder-color = #FFFFFFA8
placeholder-background = #00000000
placeholder-background-padding = 0
placeholder-background-corner-radius = 0

# 输入样式
input-background = #00000000
input-background-padding = 0
input-background-corner-radius = 0

# 默认结果样式
default-result-background = #00000000
default-result-background-padding = 4, 10
default-result-background-corner-radius = 0

# 已选择结果样式
selection-color = #000000
selection-background = #CCEEFF
selection-background-padding = 4, 10
selection-background-corner-radius = 8
selection-match-color = #00000000

text-cursor-style = bar         # 光标样式
prompt-text = "run: "           # 提示符 
placeholder-text = "..."        # 占位符
result-spacing = 8              # 结果之间的空隙

width = 1290                    # 宽度
height = 480                    # 高度
background-color = #1B1D1EBF    # 背景颜色
outline-width = 0               # 边框框线宽度，边框框线可以理解为边框外的边框
outline-color = #080800         # 边框框线颜色
border-width = 3                # 边框颜色
border-color = #cceeff          # 边框颜色
corner-radius = 24              # 圆角半径

scale = true                    # 是否随显示器比例设置而缩放
anchor = center                 # 启动器位置，center 为中心
```

{{< notice note >}}
以上的配置仅仅作为展示使用，**不是**一个有效的配置文件，因为其并非一个完整的配置文件。

你可以根据以上的内容对默认的配置文件进行修改，或从 [Dotfiles 仓库](https://github.com/Isoheptane/dotfiles/tree/main/tofi) 获取我的配置文件。
{{< /notice >}}

在保存好配置之后，可以用 `tofi-run` 或 `tofi-drun` 来启动 tofi。

### 配置 tofi 按键绑定
`tofi-run` 和 `tofi-drun` 都可以启动 tofi。

tofi 在选择要启动的应用后**并不会启动应用**，而是输出用于启动这个应用命令，因此按键绑定配置会有所不同。向 Hyprland 的配置文件中加入下面的内容：
```plain
bind = $mainMod, R, exec, tofi-drun | xargs hyprctl dispatch exec --
```

在这里设置用 Super + R 来打开 toif。在选择了要启动的应用之后，将执行 `xargs hyperctl dispatch exec --`，这将会从 `stdin` 中读取要执行的启动命令。我们通过管道将前者的输出作为了后者的输入，从而实现了启动应用。

{{< image src=tofi.webp desc="tofi 配置完成后的效果">}}

## Qt / GTK 应用主题配置
之前用的是 KDE，所以可以很方便地设置 Qt / GTK 应用的主题，在切换到 Hyprland 之后相关的主题设置依然保留。但在 KDE 环境之外想要修改 Qt / GTK 应用的主题还是会有些麻烦。

在这里我将会使用 `Adwaita` 来作为 Qt / GTK 应用的主题。
```shell
$ yay -S adwaita-qt5 adwaita-qt6
```

### Qt
这里我们将会使用 `qt5ct` 来进行主题的配置，首先安装 `qt5ct`：
```shell
$ yay -S qt5ct
```

然后在 Hyprland 的配置文件中加入环境变量：
```plain
env = QT_QPA_PLATFORMTHEME,qt5ct
```

之后即可通过 `qt5ct` 来配置 Qt5 的主题。

### GTK
[Arch Wiki](https://wiki.archlinux.org/title/GTK#Basic_theme_configuration) 上首先给出的方案是修改配置文件，然后才是使用 `gsettings` 指令。但实际测试发现还是 `gsettings` 有用，这里贴出 Arch Wiki 上给出的命令：
```shell
$ gsettings set org.gnome.desktop.interface gtk-theme Adwaita
$ gsettings set org.gnome.desktop.interface color-scheme prefer-dark
```

## 结语
于是经过这么多的操作之后，Hyprland 的环境差不多就配置好了，之后*大概*是可以比较舒适地使用了吧。~~谁叫你天天折腾桌面环境啊！~~

虽然配置还是花了不少时间，不过得到的效果也蛮不错的。不出意外的话，之后大概会一直用这个环境吧。

虽然还有例如 Alacritty 和截图工具的配置还没有提到，不过那就不是这篇文章的范畴了。