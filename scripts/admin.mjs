import readline from 'node:readline';
import { openDatabase } from '../server/db.js';
import { createAdmin, resetAdminPassword, hasAdmin } from '../server/auth.js';

function hiddenInput(prompt) {
  if (!process.stdin.isTTY) throw new Error('请在本机交互终端运行管理员命令，密码不接受命令行参数或管道。');
  return new Promise((resolve, reject) => {
    process.stdout.write(prompt); let value = '';
    const originalRaw = process.stdin.isRaw;
    process.stdin.setRawMode(true); process.stdin.resume();
    const cleanup = () => { process.stdin.off('data', onData); process.stdin.setRawMode(originalRaw); process.stdin.pause(); process.stdout.write('\n'); };
    const onData = data => {
      for (const character of data.toString('utf8')) {
        if (character === '\u0003') { cleanup(); reject(new Error('已取消')); return; }
        if (character === '\r' || character === '\n') { cleanup(); resolve(value); return; }
        if (character === '\u007f' || character === '\b') value = value.slice(0, -1);
        else if (character >= ' ') value += character;
      }
    };
    process.stdin.on('data', onData);
  });
}
if (process.argv.some(arg => /^--(?:password|username|secret)/.test(arg))) throw new Error('账号和密码只通过交互输入，不能写在命令行。');
if (!process.stdin.isTTY) throw new Error('请在本机交互终端运行 npm run admin:init');
const db = openDatabase();
try {
  const reset = process.argv.includes('--reset');
  if (hasAdmin(db) && !reset) throw new Error('管理员已存在。如需恢复密码，请使用 npm run admin:init -- --reset。');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const username = await new Promise(resolve => rl.question('管理员账号（3 至 64 位字母、数字或 ._-）：', resolve)); rl.close();
  const password = await hiddenInput('密码（12 至 256 个字符，输入隐藏）：');
  const confirmation = await hiddenInput('再次输入密码（输入隐藏）：');
  if (password !== confirmation) throw new Error('两次密码不一致，未保存。');
  if (reset) resetAdminPassword(db, username.trim(), password); else createAdmin(db, username.trim(), password);
  console.log(reset ? '管理员密码已恢复，旧会话已失效。' : '管理员已初始化，可打开 /admin 登录。');
} finally { db.close(); }
