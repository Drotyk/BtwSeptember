import argon2 from "argon2";

async function readPassword(): Promise<string> {
  const input = process.stdin;
  const output = process.stdout;
  let value = "";
  output.write("Введіть пароль для Argon2id-хешування: ");
  input.setRawMode?.(true);
  input.resume();

  return new Promise((resolve, reject) => {
    const onData = (chunk: Buffer): void => {
      const text = chunk.toString("utf8");
      if (text === "\u0003") {
        reject(new Error("Введення скасовано"));
        return;
      }
      if (text === "\r" || text === "\n") {
        input.off("data", onData);
        input.setRawMode?.(false);
        input.pause();
        output.write("\n");
        resolve(value);
        return;
      }
      if (text === "\u007f") {
        value = value.slice(0, -1);
        return;
      }
      value += text;
    };
    input.on("data", onData);
  });
}

try {
  const password = await readPassword();
  if (!password) throw new Error("Пароль не може бути порожнім");
  console.log(await argon2.hash(password, { type: argon2.argon2id }));
} catch (error) {
  process.stdin.setRawMode?.(false);
  process.stdin.pause();
  console.error(error instanceof Error ? error.message : "Не вдалося створити хеш");
  process.exitCode = 1;
}
