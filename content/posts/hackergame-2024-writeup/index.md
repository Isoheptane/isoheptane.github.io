+++
name = "hackergame-2024"
title = "Hackergame 2024 Writeup"
tags = ["Hackergame", "CTF"]
date = "2024-11-09"
update = "2024-11-09"
enableGitalk = true
+++

## 签到
60 秒肯定输入不完，因为平均 5 秒需要输入一个输入框。直接 F12，可以看到输入框的 HTML 代码大概是这样：

```HTML
<input type="text" class="input-box" id="zh" placeholder="中文：启动" onpaste="return false">
```

并且所有输入框需要输入的内容都在冒号后面，因此考虑用 JavaScript 来填写所有输入框。从元素的 `placeholder` 属性中读取提示，然后利用 `.split()` 来分割并提取冒号后的内容。最后填写到输入框中。

```JavaScript
list = document.getElementsByClassName("input-box")
for (let box of list) {
  hint = box.placeholder
  word = hint.split(/[：:]/)[1].trim()
  box.value = word
}
```

在浏览器中执行这段代码即可得到 Flag。

Flag 为 `flag{w3!Come-To-H4ckergaM3-ANd-enJOY-H@Ck!N9-zOz4}`。

## 喜欢做签到的 CTFer 你们好呀
在 Google 上搜索 UTSC CTF，可以找到 USTC NEBULA 战队在 [GitHub 上的招新安排页面](https://github.com/Nebula-CTFTeam/Recruitment-2024)。但在这个页面并不能找到 Flag，因此尝试在 UTSC NEBULA 的 [GitHub 组织页面](https://github.com/Nebula-CTFTeam)中寻找线索。可以看到 `README.me` 中有指向 [NEBULA 主页](https://www.nebuu.la/)的链接。

主页中显示的是一个网页上运行的交互式终端模拟器，我们应该来对地方了。用 `help` 指令查看可以使用的命令，然后全都尝试一遍，当执行 `env` 指令时，可以看到 env 的输出：

```properties
PWD=/root/Nebula-Homepage
ARCH=loong-arch
NAME=Nebula-Dedicated-High-Performance-Workstation
OS=NixOS❄️
FLAG=flag{actually_theres_another_flag_here_trY_to_f1nD_1t_y0urself___join_us_ustc_nebula}
REQUIREMENTS=1. you must come from USTC; 2. you must be interested in security!
```

这里其中便包含了第一个 Flag。那么第二个 Flag 在哪呢？使用 `ls` 指令可以列出当前目录下的所有文件和目录：

```plaintext
Awards
Members
Welcome-to-USTC-Nebula-s-Homepage/
and-We-are-Waiting-for-U/
```

如果尝试 `cd` 会发现需要 root 权限才能 `cd`，而尝试 `sudo` 则会跳转到[奶龙](https://www.bilibili.com/bangumi/play/ss40551)。因此考虑使用 `ls` 指令直接列出两个目录中的内容。当执行 `ls and-We-are-Waiting-for-U/` 时可以看到输出产生了一些变化，列出了隐藏的文件：

```plaintext
.flag
.oh-you-found-it/
Awards
Members
Welcome-to-USTC-Nebula-s-Homepage/
and-We-are-Waiting-for-U/
```

事实上 `ls -a` 也可以列出这个隐藏的文件，最后执行 `cat .flag` 得到第二个 Flag：

```plaintext
flag{0k_175_a_h1dd3n_s3c3rt_f14g___please_join_us_ustc_nebula_anD_two_maJor_requirements_aRe_shown_somewhere_else}
```

## 打不开的盒
下载 STL 文档，然后使用任意 3D 软件导入，在这里我使用了 Blender。删除上顶面和侧面后即可看到在内部底面的 Flag 了。

![](blender-box.png)

Flag 为 `flag{Dr4W_Us!nG_fR3E_C4D!!w0W}`。

## 比大小王
对面实在是太快了喵！所以考虑用 JavaScript 自动化，首先可以想到的是检测两边数字的大小，然后模拟点击。但实际上这样做并不能让我们做得比对方更快，因为按下之后会有延迟，然后才会显示下一道题目。因此我们需要用别的方式超过对面。

直接 F12，观察页面源码可以看到本地的 JavaScript 代码直接包裹在了 `script` 标签中。（[完整的 `script` 中的内容](compare.js)）

可以看到游戏开始时会从远程获取题目列表并存储到本地：
```JavaScript
function loadGame() {
    fetch('/game', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
    })
    .then(response => response.json())
    .then(data => {
        state.values = data.values;
        /* -- omitted -- */
    })
    /* -- omitted -- */
}
```

在按下按键时会调用 `chooseAnswer()` 函数：
```JavaScript
document.getElementById('less-than').addEventListener('click', () => chooseAnswer('<'));
document.getElementById('greater-than').addEventListener('click', () => chooseAnswer('>'));
```

在 `chooseAnswer()` 函数中，会将选择添加到 `state.inputs` 这个列表中，检测我们的答案是否正确。如果分数达到了 100，则会调用 `submit()` 提交我们的答案。
```JavaScript
function chooseAnswer(choice) {
    if (!state.allowInput) {
        return;
    }
    state.inputs.push(choice);
    let correct;
    if (state.value1 < state.value2 && choice === '<' || state.value1 > state.value2 && choice === '>') {
        correct = true;
        state.score1++;
        document.getElementById('answer').style.backgroundColor = '#5e5';
    } else {
        correct = false;
        document.getElementById('answer').style.backgroundColor = '#e55';
    }
    /* -- omitted -- */
    state.allowInput = false;
    setTimeout(() => {
        if (state.score1 === 100) {
            submit(state.inputs);
        } else if (correct) {
            /* -- omitted -- */
        } else {
            state.allowInput = false;
            state.stopUpdate = true;
            document.getElementById('dialog').textContent = '你选错了，挑战失败！';
            document.getElementById('dialog').style.display = 'flex';
        }
    }, 200);
}
```

`state` 对象可以在浏览器中访问，因此考虑编写 JavaScript 代码，读取题目并将答案写入一个列表中，最后调用 `submit()`：
```JavaScript
answers = []
for (i = 0; i < 100; i++) {
    ans = state.values[i][0] > state.values[i][1] ? '>' : '<'
    answers.push(ans)
}
submit(answers)
```

在游戏开始后，在浏览器中运行这段代码即可得到 Flag。

Flag 为 `flag{!-4M-7he-hACk3r-k!Ng-OF-cOmP@r!n9-nuM63R5-Z024}`。

## Node.js is Web Scale
题目中运行的服务是由 Node.js 编写的，在页面中点击下方的 `View source code` 即可看到 Node.js [源代码](node-web-scale-source.js)。

我们的突破点在于 `/execute` 请求， `/execute?cmd=<COMMAND>` 会执行 `cmds[<COMMAND>]` 中一个字符串形式存储的指令，并将执行结果返回。代码注释中说明 `cmds` 是常量，因此是绝对安全的。但 `cmds` 中的对象真的**完全是常量吗**？ 

可以看到 `/set` 接受 POST 请求提交的一个 JSON 对象，并且通过以 `.` 分割的 `key`，一步一步从 `store` 开始，使用 `[key]` 访问对象的属性。尽管主页中仅能设置 `value` 为字符串，但我们仍然可以通过自行构造 POST 请求来设置其他类型的值。这里将 `obj` 键的值设置为一个孔德 JSON 对象：
```json
{
    "key": "obj",
    "value": {}
}
```

在 JavaScript 中，这个值会被解析为一个空的 JavaScript Object。在服务器上，这个值会被存储到 `store.obj` 中。

在这里就需要介绍 JavaScript 的**原型链**机制了：

> JavaScript 对象是动态的属性（指其自有属性）“包”。JavaScript 对象有一个指向一个原型对象的链。当试图访问一个对象的属性时，它不仅仅在该对象上搜寻，还会搜寻该对象的原型，以及原型的原型，依次层层向上搜索，直到找到一个名字匹配的属性或到达原型链的末尾。
> From [MDN - 继承与原型链](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Inheritance_and_the_prototype_chain)

在 JavaScript 中，通过访问一个对象的 `__proto__` 属性即可访问这个对象的原型。并且访问同样可以通过 `[key]` 进行。
`cmds` 和 `store.obj` 都是一个 Object，而它们在原型链上共享了**Object 原型**。因此可以构造一个 `/set` 请求来修改/添加 Object 原型的属性。我们向 Object 原型中添加 `our_cmd` 属性，这样在访问 `cmds["our_cmd"]` 时，即使 `cmds` 本身不具有 `our_cmd` 属性，也会顺着原型链寻找这个属性，直到找到我们在 Object 原型中添加的属性。

构造一个 `/set` 请求，向 Object 原型中添加 `our_cmd` 属性，并将这个属性的值设置为我们要执行的指令：
```json
{
    "key": "obj.__proto__.our_cmd",
    "value": "cat /flag"
}
```

最后请求 `/execute?cmd=our_cmd`，即可成功执行我们构造的指令，获取 Flag。

Flag 为 `flag{n0_pr0topOIl_50_U5E_new_Map_1n5teAD_Of_0bject2kv_327578b540}`

