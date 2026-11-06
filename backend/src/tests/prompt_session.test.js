import { test } from 'node:test';
import assert from 'node:assert';
import readline from 'readline';
import { Writable, PassThrough } from 'stream';

function createPromptSession(input, output) {
  const isTTY = Boolean(input.isTTY);
  let muted = false;

  const mutableStdout = new Writable({
    write(chunk, encoding, callback) {
      if (!muted || !isTTY) {
        output.write(chunk, encoding);
      }
      callback();
    },
  });

  const rl = readline.createInterface({
    input,
    output: mutableStdout,
    terminal: isTTY,
  });

  function prompt(questionText) {
    return new Promise((resolve) => {
      muted = false;
      rl.question(questionText, (answer) => {
        resolve(answer.trim());
      });
    });
  }

  function promptHidden(questionText) {
    return new Promise((resolve) => {
      muted = false;
      rl.question(questionText, (answer) => {
        muted = false;
        if (isTTY) {
          output.write('\n');
        }
        resolve(answer.replace(/\r$/, ''));
      });
      if (isTTY) {
        muted = true;
      }
    });
  }

  function close() {
    muted = false;
    rl.close();
  }

  return { prompt, promptHidden, close };
}

test('Prompt Session - Sequential prompts maintain stream integrity across Windows CRLF', async () => {
  const inStream = new PassThrough();
  const outStream = new PassThrough();
  inStream.isTTY = true;

  const session = createPromptSession(inStream, outStream);

  const namePromise = session.prompt('Name: ');
  inStream.write('Dr. Ali Ahmed\r\n');
  const name = await namePromise;
  assert.strictEqual(name, 'Dr. Ali Ahmed');

  const pass1Promise = session.promptHidden('Password: ');
  inStream.write('SecurePass123!@#\r');
  const pass1 = await pass1Promise;

  // Delayed LF from Windows console newline sequence
  const pass2Promise = session.promptHidden('Confirm: ');
  setTimeout(() => {
    inStream.write('\n');
    setTimeout(() => {
      inStream.write('SecurePass123!@#\r\n');
    }, 10);
  }, 5);

  const pass2 = await pass2Promise;
  session.close();

  assert.strictEqual(pass1.length, pass2.length);
  assert.strictEqual(pass1, pass2);
});

test('Prompt Session - Preserves exact special characters without trimming or modification', async () => {
  const inStream = new PassThrough();
  const outStream = new PassThrough();
  inStream.isTTY = false;

  const session = createPromptSession(inStream, outStream);
  const complexPassword = 'Complex!@#$%^&*()_+~`|}{[]:;?><,./123';

  const p1 = session.promptHidden('Password: ');
  inStream.write(complexPassword + '\n');
  const pass1 = await p1;

  const p2 = session.promptHidden('Confirm: ');
  inStream.write(complexPassword + '\n');
  const pass2 = await p2;

  session.close();

  assert.strictEqual(pass1, complexPassword);
  assert.strictEqual(pass2, complexPassword);
  assert.strictEqual(pass1 === pass2, true);
});
