# NIR — استقرار در ویندوز ۱۰ (Production)

این سند برای تیم فنی است. برای اپراتور کارخانه، فایل `README-FACTORY.txt` را ببینید.

## معماری تولید

```
Caddy :443 (HTTPS)  ──►  NIR server :3000 (Node, 0.0.0.0)  ──►  PostgreSQL (127.0.0.1:5432)
```

* فرانت‌اند React/PWA و API روی یک سرور Express سرو می‌شوند.
* پایگاه‌داده PostgreSQL تنها منبع معتبر داده است (SQLite/Firestore استفاده نمی‌شود).
* حالت آفلاین فرانت‌اند با IndexedDB + صف همگام‌سازی (`/api/sync`) کار می‌کند.

## بسته‌ی تولید

بسته‌ی `NIR-Factory-Production-Windows.zip` توسط GitHub Actions ساخته می‌شود و شامل:

```
NIR/
├── server.cjs            (bundle سرور، بدون نیاز به npm/Node سیستمی)
├── db-migrate.cjs        (اجرای Migration با Node همراه)
├── dist/                 (فرانت‌اند ساخته‌شده)
├── runtime/node.exe      (Node ویندوزی همراه)
├── deploy/windows/       (اسکریپت‌های نصب و بهره‌برداری)
├── data/{uploads,backups}
├── .env.example
├── INSTALL-NIR.ps1  INSTALL-INTERNET.ps1
├── START-NIR.bat  STOP-NIR.bat  RESTART-NIR.bat
├── BACKUP-NIR.ps1  RESTORE-NIR.ps1  UNINSTALL-NIR.ps1
└── README-FACTORY.txt
```

نیازمندی کامپیوتر کارخانه: فقط ویندوز ۶۴ بیتی و PostgreSQL 16+ (یا نسخه‌ی
خصوصی که نصب‌کننده خودش می‌سازد). npm، Node سیستمی، Git، Vite و TypeScript
لازم نیست.

## نصب

```powershell
# روی کامپیوتر کارخانه، PowerShell با دسترسی Administrator
powershell -NoProfile -ExecutionPolicy Bypass -File .\INSTALL-NIR.ps1
```

نصب‌کننده idempotent است (اجرای دوباره، سرویس/تسک تکراری نمی‌سازد). جزئیات
گام‌ها و گزینه‌ها در ابتدای فایل `INSTALL-NIR.ps1` آمده است.

## دسترسی اینترنت

`INSTALL-INTERNET.ps1` استراتژی مناسب را خودکار انتخاب می‌کند. توضیح کامل،
رکوردهای DNS و حالت‌های CGNAT در `docs/Internet-Access.md`.

## سرویس‌های خودکار (Scheduled Tasks)

| Task | نقش |
|------|-----|
| `NIR Factory Server` | اجرای پیوسته‌ی سرور NIR (SYSTEM، در بوت) |
| `NIR Caddy Proxy` | پروکسی HTTPS روی ۴۴۳ |
| `NIR DDNS Updater` | به‌روزرسانی رکورد DNS هر ۵ دقیقه |
| `NIR PostgreSQL` | فقط اگر از PostgreSQL پرتابل استفاده شود |

## توسعه‌ی محلی

```bash
npm ci --include=dev --legacy-peer-deps
npm run typecheck
npm run lint
npm test            # نیاز به PostgreSQL واقعی (DATABASE_URL)
npm run build       # dist/ + dist/server.cjs
npm start           # اجرای نسخه‌ی تولید
```

> نکته: تست‌های یکپارچه (`tests/api.test.ts`) به یک PostgreSQL واقعی نیاز دارند
> و در GitHub Actions با سرویس PostgreSQL اجرا می‌شوند.
