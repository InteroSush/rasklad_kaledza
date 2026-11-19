# Расклад: як запусціць на GitHub

Сайт сам забірае расклад з raspisanie.nikasoft.ru кожныя 15 хвілін (GitHub Actions) і публікуецца на GitHub Pages. Хостынг не патрэбны.

## 1. Рэпазіторый
1. Увайдзіце на github.com, націсніце **New repository**, назва, напрыклад, `raspisanie`, тып **Public** (Pages на бясплатным тарыфе працуе для публічных рэпазіторыяў). Націсніце **Create**.
2. Загрузіце файлы з гэтай папкі, любым спосабам:

**Праз git (самы надзейны):**
```
cd schedule-app
git init -b main
git add .
git commit -m "init"
git remote add origin https://github.com/ВАШ_ЛОГІН/raspisanie.git
git push -u origin main
```
**Праз браўзер:** на старонцы рэпазіторыя **Add file → Upload files**, перацягніце папкі `site` і `scripts` і файл `README.md`. Папку `.github` браўзер часта не прымае, таму: **Add file → Create new file**, у полі імя ўвядзіце `.github/workflows/update.yml`, уставьце ўвесь тэкст з аднайменнага файла і націсніце **Commit**.

## 2. Уключыце Pages і правы
1. **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. **Settings → Actions → General → Workflow permissions → Read and write permissions → Save**.

## 3. Першы запуск
**Actions → Update schedule and deploy → Run workflow**. Праз хвіліну-дзве сайт будзе тут:
`https://ВАШ_ЛОГІН.github.io/raspisanie/`
Далей расклад абнаўляецца сам. Спазненне запуску па cron на некалькі хвілін нармальна.

## 4. Устаноўка ў Chrome
Адкрыйце сайт. На кампутары: значок усталёўкі ў канцы адраснага радка або ⋮ → **Ператварыць у прыкладанне / Усталяваць «Расклад»**. На Android: ⋮ → **Усталяваць прыкладанне**. Расклад працуе і без сеткі (паказваецца апошні захаваны).

## Карыснае
- Захаванне групы ці настаўніка: адкрыйце яго і націсніце ☆ уверсе. Ён з'явіцца на галоўнай у раздзеле «Мой расклад». Захоўваецца ў браўзеры на гэтай прыладзе.
- Колеры: чорны (звычайны ўрок), чырвоны (замена або адмена), сіні (УПК і падобныя). Правіла ўзята з арыгінальнага `schedule.js`.
- Часавы пояс (для «сёння») задаецца ў `site/app.js`, радок `const TZ = "Europe/Minsk"`.
- Іншы расклад: зменіце ID у `scripts/fetch_schedule.py` (`25711519`).
- Праверка парсера без сеткі: `python3 scripts/fetch_schedule.py --file шлях/да/25711519_....js`.
- Калі запуск у Actions чырвоны: адкрыйце яго лог. Магчыма, nikasoft блакуе IP-адрасы GitHub. Тады скажыце, абмяркуем абход.
- Калі ў рэпазіторыі 60 дзён няма змен (напрыклад, лета), GitHub выключае запланаваныя запускі. Уключыце іх зноў на ўкладцы Actions.
