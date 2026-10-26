# رفع المشروع من Termux — خطوة بخطوة

## قبل البدء

1. أنشئ مستودعاً جديداً فارغاً على GitHub باسم `Blaugrana-Nova-Complete`. لا تضف README أو License أو `.gitignore` من صفحة إنشاء المستودع، لأن المشروع يحتوي هذه الملفات بالفعل.
2. نزّل `Blaugrana-Nova-Complete.zip` إلى مجلد Downloads في الهاتف.

## الأوامر

```bash
termux-setup-storage
pkg update
pkg install git unzip
cd ~/storage/downloads
unzip Blaugrana-Nova-Complete.zip
cd Blaugrana-Nova-Complete
git init -b main
git add .
git commit -m "Create clean Blaugrana Nova project"
git remote add origin https://github.com/YOUR-GITHUB-USERNAME/Blaugrana-Nova-Complete.git
git push -u origin main
```

بدّل `YOUR-GITHUB-USERNAME` باسم حسابك إذا كان مختلفاً. إذا كان Git يطلب اسمك وبريدك قبل `git commit`، عرّفهما على الجهاز بأوامر `git config --global user.name` و`git config --global user.email`.

## الحصول على APK

بعد نجاح الرفع، افتح المستودع على GitHub ثم **Actions** ثم تشغيل `Build Blaugrana Nova APK`. انتظر أن تنتهي الوظيفة بحالة نجاح، وافتح التشغيل ونزّل Artifact باسم `Blaugrana-Nova-debug-apk`.

إذا فشل البناء، أرسل رابط تشغيل GitHub Actions أو سجل الخطأ؛ لا تدمج ملفات هذا المشروع مع مجلد المشروع القديم لمحاولة إصلاحه.
