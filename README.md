# رفيق القرآن — Refactored

نسخة Refactor منظمة لتطبيق رفيق القرآن مع الحفاظ على الواجهة والوظائف قدر الإمكان.

## Structure

```text
rafiq-refactored/
├── index.html
├── css/
│   ├── tokens.css
│   ├── app.css
│   └── print.css
├── js/
│   ├── app.js
│   ├── data.js
│   ├── state.js
│   ├── storage.js
│   └── particles.js
├── manifest.webmanifest
├── sw.js
├── icon.svg
├── icon-192.png
├── icon-512.png
└── quran-uthmani.json
```

> ملفات الأصول المذكورة أعلاه يجب أن تبقى من مشروعك الأصلي إن لم تكن موجودة في هذه الحزمة.

## GitHub Pages

1. افتح repository الحالي.
2. ارفع **محتويات هذا المجلد** إلى جذر الـrepository، وليس مجلد `rafiq-refactored` نفسه.
3. تأكد أن `index.html` موجود في جذر الفرع المنشور.
4. من:
   **Settings → Pages**
   اختر:
   - Source: `Deploy from a branch`
   - Branch: الفرع الذي ترفع عليه (غالبًا `main`)
   - Folder: `/ (root)`
5. احفظ وانتظر انتهاء GitHub Pages deployment.

### مهم جدًا

لا ترفع مجلدًا داخل مجلد بحيث يصبح المسار:

`rafiq-refactored/index.html`

إذا كان GitHub Pages مضبوطًا على root، المطلوب:

`index.html`

`css/app.css`

`js/app.js`

وهكذا.

## تحديث المشروع بدون تكسير النسخة القديمة

الأفضل قبل أول رفع:

```bash
git add .
git commit -m "refactor: modularize Rafiq Quran"
git push
```

ولو حصلت مشكلة، تستطيع الرجوع للـcommit السابق.

## ملاحظات

- `state.js`: تعريف الحالة الافتراضية ومفتاح التخزين.
- `storage.js`: القراءة/الدمج والحفظ المؤجل في localStorage.
- `data.js`: البيانات الثابتة فقط.
- `particles.js`: نظام Canvas واحد للمؤثرات.
- `app.js`: منطق التطبيق وربط الواجهة.
- لا تعتمد على React/Vue أو bundler؛ لذلك GitHub Pages يمكنه تشغيل المشروع مباشرة باستخدام ES Modules.
