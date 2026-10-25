/* ثبت تگ جدید — InventoryTagCreate */
HelpRegistry.register('InventoryTagCreate', {
    title: 'ثبت تگ جدید',
    subtitle: 'ایجاد برگه شمارش فیزیکی',
    sections: [
        {
            type: 'text', icon: '➕', title: 'مراحل',
            body: `<ol>
                     <li>انتخاب <b>انبار</b> و <b>مرحله</b></li>
                     <li>تاریخ و کد مکان (اختیاری)</li>
                     <li>دکمه <b>➕ افزودن کالا</b> را بزن</li>
                     <li>در Picker: می‌توانی چند کالا را همزمان انتخاب کنی (چک‌باکس)</li>
                     <li>«✔️ انتخاب همه» برای انتخاب همه کالاهای یک گروه</li>
                     <li>«ثبت نهایی تگ» را بزن</li>
                 </ol>` },
        {
            type: 'text', icon: '📊', title: 'فیلترهای Picker',
            body: `<ul>
                     <li>فیلتر انبار (خودکار از تگ)</li>
                     <li>فیلتر گروه کالا</li>
                     <li>جستجو بر اساس کد یا نام</li>
                 </ul>` },
        { type: 'tip', variant: 'success', icon: '🖨️', text: 'بعد از ثبت تگ، می‌توانی برگه‌های شمارش (برچسب با بارکد) را همون لحظه چاپ کنی.' }
    ]
});