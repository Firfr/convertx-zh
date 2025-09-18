import { randomUUID } from "node:crypto";
import { Html } from "@elysiajs/html";
import { jwt } from "@elysiajs/jwt";
import { Elysia, t } from "elysia";
import { BaseHtml } from "../components/base";
import { Header } from "../components/header";
import db from "../db/db";
import { User } from "../db/types";
import {
  ACCOUNT_REGISTRATION,
  ALLOW_UNAUTHENTICATED,
  HIDE_HISTORY,
  HTTP_ALLOWED,
  WEBROOT,
} from "../helpers/env";

export let FIRST_RUN = db.query("SELECT * FROM users").get() === null || false;

export const userService = new Elysia({ name: "user/service" })
  .use(
    jwt({
      name: "jwt",
      schema: t.Object({
        id: t.String(),
      }),
      secret: process.env.JWT_SECRET ?? randomUUID(),
      exp: "7d",
    }),
  )
  .model({
    signIn: t.Object({
      email: t.String(),
      password: t.String(),
    }),
  })
  .macro({
    isSignIn(enabled: boolean) {
      if (!enabled) return;

      return {
        async beforeHandle({ status, jwt, cookie: { auth } }) {
          if (auth?.value) {
            const user = await jwt.verify(auth.value);
            return {
              success: true,
              user,
            };
          }

          return status(401, {
            success: false,
            message: "未授权",
          });
        },
      };
    },
  });

export const user = new Elysia()
  .use(userService)
  .get("/setup", ({ redirect }) => {
    if (!FIRST_RUN) {
      return redirect(`${WEBROOT}/login`, 302);
    }

    return (
      <BaseHtml title="ConvertX | 设置" webroot={WEBROOT}>
        <main
          class={`
            mx-auto w-full max-w-4xl flex-1 px-2
            sm:px-4
          `}
        >
          <h1 class="my-8 text-3xl">欢迎使用 ConvertX!</h1>
          <article class="article p-0">
            <header class="w-full bg-neutral-800 p-4">创建您的账户</header>
            <form method="post" action={`${WEBROOT}/register`} class="p-4">
              <fieldset class="mb-4 flex flex-col gap-4">
                <label class="flex flex-col gap-1">
                  邮箱
                  <input
                    type="email"
                    name="email"
                    class="rounded-sm bg-neutral-800 p-3"
                    placeholder="邮箱"
                    autocomplete="email"
                    required
                  />
                </label>
                <label class="flex flex-col gap-1">
                  密码
                  <input
                    type="password"
                    name="password"
                    class="rounded-sm bg-neutral-800 p-3"
                    placeholder="密码"
                    autocomplete="current-password"
                    required
                  />
                </label>
              </fieldset>
              <input type="submit" value="创建账户" class="btn-primary" />
            </form>
            <footer class="p-4">
              反馈问题 {" "}
              <a
                class={`
                  text-accent-500 underline
                  hover:text-accent-400
                `}
                href="https://github.com/C4illin/ConvertX"
              >
                GitHub
              </a>
              .
            </footer>
          </article>
        </main>
      </BaseHtml>
    );
  })
  .get("/register", ({ redirect }) => {
    if (!ACCOUNT_REGISTRATION) {
      return redirect(`${WEBROOT}/login`, 302);
    }

    return (
      <BaseHtml webroot={WEBROOT} title="ConvertX | 注册">
        <>
          <Header
            webroot={WEBROOT}
            accountRegistration={ACCOUNT_REGISTRATION}
            allowUnauthenticated={ALLOW_UNAUTHENTICATED}
            hideHistory={HIDE_HISTORY}
          />
          <main
            class={`
              w-full flex-1 px-2
              sm:px-4
            `}
          >
            <article class="article">
              <form method="post" class="flex flex-col gap-4">
                <fieldset class="mb-4 flex flex-col gap-4">
                  <label class="flex flex-col gap-1">
                    邮箱
                    <input
                      type="email"
                      name="email"
                      class="rounded-sm bg-neutral-800 p-3"
                      placeholder="邮箱"
                      autocomplete="email"
                      required
                    />
                  </label>
                  <label class="flex flex-col gap-1">
                    密码
                    <input
                      type="password"
                      name="password"
                      class="rounded-sm bg-neutral-800 p-3"
                      placeholder="密码"
                      autocomplete="current-password"
                      required
                    />
                  </label>
                </fieldset>
                <input type="submit" value="注册" class="w-full btn-primary" />
              </form>
            </article>
          </main>
        </>
      </BaseHtml>
    );
  })
  .post(
    "/register",
    async ({ body: { email, password }, set, redirect, jwt, cookie: { auth } }) => {
      if (!ACCOUNT_REGISTRATION && !FIRST_RUN) {
        return redirect(`${WEBROOT}/login`, 302);
      }

      if (FIRST_RUN) {
        FIRST_RUN = false;
      }

      const existingUser = await db.query("SELECT * FROM users WHERE email = ?").get(email);
      if (existingUser) {
        set.status = 400;
        return {
          message: "Email already in use.",
        };
      }
      const savedPassword = await Bun.password.hash(password);

      db.query("INSERT INTO users (email, password) VALUES (?, ?)").run(email, savedPassword);

      const user = db.query("SELECT * FROM users WHERE email = ?").as(User).get(email);

      if (!user) {
        set.status = 500;
        return {
          message: "创建用户失败",
        };
      }

      const accessToken = await jwt.sign({
        id: String(user.id),
      });

      if (!auth) {
        set.status = 500;
        return {
          message: "无认证Cookie，可能是您的浏览器阻止了Cookie。",
        };
      }

      // set cookie
      auth.set({
        value: accessToken,
        httpOnly: true,
        secure: !HTTP_ALLOWED,
        maxAge: 60 * 60 * 24 * 7,
        sameSite: "strict",
      });

      return redirect(`${WEBROOT}/`, 302);
    },
    { body: "signIn" },
  )
  .get("/login", async ({ jwt, redirect, cookie: { auth } }) => {
    if (FIRST_RUN) {
      return redirect(`${WEBROOT}/setup`, 302);
    }

    // if already logged in, redirect to home
    if (auth?.value) {
      const user = await jwt.verify(auth.value);

      if (user) {
        return redirect(`${WEBROOT}/`, 302);
      }

      auth.remove();
    }

    return (
      <BaseHtml webroot={WEBROOT} title="ConvertX | 登录">
        <>
          <Header
            webroot={WEBROOT}
            accountRegistration={ACCOUNT_REGISTRATION}
            allowUnauthenticated={ALLOW_UNAUTHENTICATED}
            hideHistory={HIDE_HISTORY}
          />
          <main
            class={`
              w-full flex-1 px-2
              sm:px-4
            `}
          >
            <article class="article">
              <form method="post" class="flex flex-col gap-4">
                <fieldset class="mb-4 flex flex-col gap-4">
                  <label class="flex flex-col gap-1">
                    邮箱
                    <input
                      type="email"
                      name="email"
                      class="rounded-sm bg-neutral-800 p-3"
                      placeholder="邮箱"
                      autocomplete="email"
                      required
                    />
                  </label>
                  <label class="flex flex-col gap-1">
                    密码
                    <input
                      type="password"
                      name="password"
                      class="rounded-sm bg-neutral-800 p-3"
                      placeholder="密码"
                      autocomplete="current-password"
                      required
                    />
                  </label>
                </fieldset>
                <div class="flex flex-row gap-4">
                  {ACCOUNT_REGISTRATION ? (
                    <a
                      href={`${WEBROOT}/register`}
                      role="button"
                      class="w-full btn-secondary text-center"
                    >
                      注册
                    </a>
                  ) : null}
                  <input type="submit" value="登录" class="w-full btn-primary" />
                </div>
              </form>
            </article>
          </main>
        </>
      </BaseHtml>
    );
  })
  .post(
    "/login",
    async function handler({ body, set, redirect, jwt, cookie: { auth } }) {
      const existingUser = db.query("SELECT * FROM users WHERE email = ?").as(User).get(body.email);

      if (!existingUser) {
        set.status = 403;
        return {
          message: "凭据无效",
        };
      }

      const validPassword = await Bun.password.verify(body.password, existingUser.password);

      if (!validPassword) {
        set.status = 403;
        return {
          message: "凭据无效",
        };
      }

      const accessToken = await jwt.sign({
        id: String(existingUser.id),
      });

      if (!auth) {
        set.status = 500;
        return {
          message: "无认证Cookie，可能是您的浏览器阻止了Cookie。",
        };
      }

      // set cookie
      auth.set({
        value: accessToken,
        httpOnly: true,
        secure: !HTTP_ALLOWED,
        maxAge: 60 * 60 * 24 * 7,
        sameSite: "strict",
      });

      return redirect(`${WEBROOT}/`, 302);
    },
    { body: "signIn" },
  )
  .get("/logoff", ({ redirect, cookie: { auth } }) => {
    if (auth?.value) {
      auth.remove();
    }

    return redirect(`${WEBROOT}/login`, 302);
  })
  .post("/logoff", ({ redirect, cookie: { auth } }) => {
    if (auth?.value) {
      auth.remove();
    }

    return redirect(`${WEBROOT}/login`, 302);
  })
  .get("/account", async ({ jwt, redirect, cookie: { auth } }) => {
    if (!auth?.value) {
      return redirect(`${WEBROOT}/`);
    }
    const user = await jwt.verify(auth.value);

    if (!user) {
      return redirect(`${WEBROOT}/`, 302);
    }

    const userData = db.query("SELECT * FROM users WHERE id = ?").as(User).get(user.id);

    if (!userData) {
      return redirect(`${WEBROOT}/`, 302);
    }

    return (
      <BaseHtml webroot={WEBROOT} title="ConvertX | 账户">
        <>
          <Header
            webroot={WEBROOT}
            accountRegistration={ACCOUNT_REGISTRATION}
            allowUnauthenticated={ALLOW_UNAUTHENTICATED}
            hideHistory={HIDE_HISTORY}
            loggedIn
          />
          <main
            class={`
              w-full flex-1 px-2
              sm:px-4
            `}
          >
            <article class="article">
              <form method="post" class="flex flex-col gap-4">
                <fieldset class="mb-4 flex flex-col gap-4">
                  <label class="flex flex-col gap-1">
                    邮箱
                    <input
                      type="email"
                      name="email"
                      class="rounded-sm bg-neutral-800 p-3"
                      placeholder="邮箱"
                      autocomplete="email"
                      value={userData.email}
                      required
                    />
                  </label>
                  <label class="flex flex-col gap-1">
                    密码（留空表示不更改）
                    <input
                      type="password"
                      name="newPassword"
                      class="rounded-sm bg-neutral-800 p-3"
                      placeholder="密码"
                      autocomplete="new-password"
                    />
                  </label>
                  <label class="flex flex-col gap-1">
                    当前密码
                    <input
                      type="password"
                      name="password"
                      class="rounded-sm bg-neutral-800 p-3"
                      placeholder="密码"
                      autocomplete="current-password"
                      required
                    />
                  </label>
                </fieldset>
                <div role="group">
                  <input type="submit" value="更新" class="w-full btn-primary" />
                </div>
              </form>
            </article>
          </main>
        </>
      </BaseHtml>
    );
  })
  .post(
    "/account",
    async function handler({ body, set, redirect, jwt, cookie: { auth } }) {
      if (!auth?.value) {
        return redirect(`${WEBROOT}/login`, 302);
      }

      const user = await jwt.verify(auth.value);
      if (!user) {
        return redirect(`${WEBROOT}/login`, 302);
      }
      const existingUser = db.query("SELECT * FROM users WHERE id = ?").as(User).get(user.id);

      if (!existingUser) {
        if (auth?.value) {
          auth.remove();
        }
        return redirect(`${WEBROOT}/login`, 302);
      }

      const validPassword = await Bun.password.verify(body.password, existingUser.password);

      if (!validPassword) {
        set.status = 403;
        return {
          message: "凭据无效",
        };
      }

      const fields = [];
      const values = [];

      if (body.email) {
        const existingUser = await db
          .query("SELECT id FROM users WHERE email = ?")
          .as(User)
          .get(body.email);
        if (existingUser && existingUser.id.toString() !== user.id) {
          set.status = 409;
          return { message: "Email already in use." };
        }
        fields.push("email");
        values.push(body.email);
      }
      if (body.newPassword) {
        fields.push("password");
        values.push(await Bun.password.hash(body.newPassword));
      }

      if (fields.length > 0) {
        db.query(
          `UPDATE users SET ${fields.map((field) => `${field}=?`).join(", ")} WHERE id=?`,
        ).run(...values, user.id);
      }

      return redirect(`${WEBROOT}/`, 302);
    },
    {
      body: t.Object({
        email: t.MaybeEmpty(t.String()),
        newPassword: t.MaybeEmpty(t.String()),
        password: t.String(),
      }),
    },
  );
