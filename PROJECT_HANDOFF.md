# RepHear 项目交接

最后更新：2026-10-13（Europe/London）

## 开始工作时

先读取本文及仓库根目录的 `AGENTS.md`。以当前代码、测试及部署记录为准；本文中的历史信息不能代替验证。

## 最新功能：右上角用户名进入主页

- 用户要求点击右上角用户名（例如 Conan）直接进入该登录用户的主页。
- 已修改 src/components/HeaderAuth.tsx 和 src/components/homepage/SiteHeader.tsx，传入 userId，将用户名链接到与 My Profile 相同的 /u/{userId} 路由，增加悬停和键盘焦点提示。
- 保留无 userId 时的文字回退，避免生成无效主页地址。
- 状态：本地实现完成；TypeScript 全项目检查、两个组件 ESLint 和 git diff --check 均通过。未执行登录浏览器点击验证，未提交、未推送、未部署。
- Recognise 多弹窗问题仍未修复。

## 实际仓库检查结果

### 2026-10-13：Recognise 多弹窗问题（未修复）

- 用户提供活动页面完整异常截图：多组 Public recognition 超时弹窗同时出现，遮罩叠加使背景接近全黑。
- 已检查 `src/components/events/RecognitionButton.tsx`：每个按钮实例独立维护 pending/result 并创建自己的全屏遮罩，没有跨卡片请求协调或单一弹窗控制。多个卡片请求尚未返回时，其他卡片仍可点击；多请求超时后可各自保留弹窗。这是代码支持的复现路径，用户当时具体点击顺序未知。
- 前端超时为 12 秒；Promise.race 不取消 recognizeAtEventAction，且晚到的结果不会继续更新按钮。出现超时不能证明数据库未保存。
- 页面在 New here、Recently recognized、Discover your people 多个区块复用人物卡片，各实例没有共享 pending 状态。
- 后端 recognizeAtEventAction 包含登录核验、事件及人物读取、recognizePerson 写入、revalidatePath 以及最多等待 1.5 秒的可选通知/邮件工作。具体慢在何处尚未测得，不能直接归因数据库或 Render。
- 已在未登录浏览器访问线上 `/events/mcm-london-2026`，公开页面可正常打开。未执行生产 Recognise、未发送通知邮件、未取得登录请求及服务器日志。
- 下一步：用测试账户和非生产环境复现多个卡片同时点击及延迟响应；修复跨卡片协调、单一弹窗及晚到结果处理，并测试关闭/超时/重复卡片。保留用户确认的弹窗定位和速度设置；再核实生产请求耗时及日志。
- 本次为检查和问题记录，未修改业务代码，未部署。

- 仓库：https://github.com/Rookie99bb/rephear
- 最新本地副本：`/Users/huan/Documents/Codex/2026-10-08/referenced-chatgpt-conversation-this-is-untrusted/rephear`。
- 当前分支：`main`。本地 HEAD：`d083beeefc3ae1eedb2fe0892967ae82760336ee`，2026-10-13 22:15:35 +0100，`feat: prioritize special draws on homepage`。
- 当前分支领先本地记录的 `origin/main` 16 个提交；本次未联网刷新远程，不能据此认定这些提交没有推送。
- 已有未提交修改：`tsconfig.tsbuildinfo`，必须保留。
- 其他旧副本包含不同分支及未提交业务修改，不能混用或覆盖。
- 最近提交还包含 Weekly Backer draw、Daily Presence、Road to MCM、Backer 成长及社区治理；仅核对了提交记录，功能测试和生产部署尚未验证。
- 技术配置：Next.js 14、TypeScript、Node >=22.5；Render 配置使用 Turso，提供 `/api/health` 和抽奖定时任务配置。
- 发现重要文档问题：README 仍描述本地 SQLite/持久磁盘，而 render.yaml 描述 Turso。后续应核实 src/db/client.ts 及实际部署，再统一说明。
- 本次仅新增交接文档和规则，无业务代码修改，无功能测试，无生产部署。
- 文档尚未提交或推送到 GitHub；后续提交时仅选择文档，勿夹带已有修改或未经核实的其他提交。

## 发起聊天的项目镜像环境（与实际仓库不同）

- 当前聊天属于 ChatGPT 项目“网站的初版”，用于继续 RepHear 工作。
- 当前目录是项目的本地镜像，尚未发现网站代码或 Git 仓库。
- `sources/` 当前为空，属于只读参考目录。
- 根目录 `AGENTS.md` 是只读同步文件，规则禁止修改同步文件；因此新增开发规则保存在 `development/AGENTS.md`。这些规则尚未安装到实际网站仓库根目录。
- 新增本地文件是否会同步到后续聊天尚未确认。新聊天应确认能读取本文，不能假定已同步。

## 已确认的用户要求

- 交接文档不能等到对话结束才更新。
- 每完成独立功能、重要 Bug 修复、正式部署后立即更新。
- 发现尚未解决的重要问题时立即记录。
- 用户此前已确认弹窗速度“可以了”；保持已确认的设置，除非用户另有要求。

## 历史状态（待重新验证）

- 用户提供的截图显示生产地址为 `https://rephear.com`，Render 曾显示 `Deploy succeeded · Live`。这不是当前在线状态的验证。
- 原开发聊天“Continue website issue check”最后一次任务因上下文窗口容量耗尽、压缩失败而中断。最后一次网站问题检查未完成。
- 用户曾上传网站异常截图，但本聊天只有该图片在聊天截图中的缩略图，无法确定异常细节或原因。
- 当前未检查网站代码、当前提交、测试结果或最新部署。

## 本次已完成

- 创建本交接文档。
- 在 `development/AGENTS.md` 保存按开发节点及时更新交接文档的规则。
- 未修改网站功能，未部署网站，未将文件保存到 GitHub。

## 尚未解决的重要问题及下一步

1. 实际仓库已找到，见上方检查结果；交接文档和规则需要保存并确认在真实仓库生效。
2. 核实生产版本、Render 部署结果和当前网站表现。
3. 获取或找到网站异常原图，复现并确认问题后修复；保留用户已确认的弹窗设置。
4. 按仓库流程保存文档，记录提交及文件链接。尚无提交或 GitHub 链接可提供。

## 更新方式

保持一份精简的当前状态，明确标记进行中、已完成、已验证和待验证；记录重要证据、相关文件、提交、部署及下一步。不得记录密码、密钥或访问令牌。
