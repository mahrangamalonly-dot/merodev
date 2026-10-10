# Mero Dev

موقع بيع تطبيق **Mero Dev POS** + التطبيق نفسه + لوحة إدارة التراخيص.

## المكونات

| المجلد | الوصف | التشغيل |
|---|---|---|
| `/` | الموقع التسويقي (HTML/CSS/JS ثابت) | `npx vercel` أو أي استضافة ثابتة |
| `pos/` | تطبيق نقاط البيع (ويب + إلكترون) | `npm start` ثم `npm run electron` |
| `admin/` | لوحة إدارة التراخيص (مفاتيح، أجهزة، طلبات) | `npm start` → المنفذ 4180 |
| `license-server/` | API التراخيص والدفع | `npm start` → المنفذ 8787 |

## التشغيل المحلي

```bash
cd pos && npm start            # التطبيق
cd admin && npm start          # لوحة الإدارة
cd license-server && npm start # سيرفر التراخيص
```

## الإعداد

1. **الموقع**: عدّل `assets/js/config.js` (روابط الدفع، التحميل، الفورم).
2. **الترخيص**: انسخ `license-server/.env.example` إلى `.env` واضبط `ADMIN_TOKEN`.
3. **ربط التطبيق**: في إعدادات تطبيق POS ضع رابط السيرفر في حقل "سيرفر الترخيص"
   → كل تفعيل يمر عبر السيرفر، ولا يمكن توليد المفاتيح من التطبيق.
4. **بناء التطبيق**: `cd pos && npm run dist`، أو ارفع tag (`git tag v1.0.0 && git push --tags`)
   ليبني ملفات ويندوز/لينكس تلقائيًا عبر GitHub Actions.

## إدارة المفاتيح

```bash
cd license-server
node cli.cjs batch 10 pro      # إصدار 10 مفاتيح
node cli.cjs list              # عرض المفاتيح
node cli.cjs revoke MERO-XXXX-XXXX-XXXX
```

أو من لوحة الإدارة على `http://127.0.0.1:4180`.

## البنية

- لا توجد تبعيات خارجية في الموقع ولا في التطبيق ولا في اللوحة — JavaScript خالص.
- تخزين التطبيق محلي (`localStorage`) مع نسخ احتياطي JSON.
- المفاتيح بصيغة `MERO-XXXX-XXXX-XXXX` مع بصمة تحقق (checksum).
