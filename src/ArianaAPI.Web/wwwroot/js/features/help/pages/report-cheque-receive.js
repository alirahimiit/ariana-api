/* گزارش چک‌های دریافتی — report-cheque-receive */
HelpRegistry.register('report-cheque-receive', {
    title: 'گزارش چک‌های دریافتی',
    subtitle: 'لیست کامل چک‌های دریافتی با وضعیت خرج',
    sections: [
        {
            type: 'text', icon: '📊', title: 'کار با این گزارش',
            body: `<p>مشابه گزارش چک‌های پرداختی، با ستون‌های اضافی:</p>
                 <ul>
                     <li><b>وضعیت چک:</b> وصول / برگشت / در جریان</li>
                     <li><b>وضعیت خرج:</b> آزاد / در جریان خرج / خرج‌شده</li>
                 </ul>` },
        { type: 'tip', variant: 'info', icon: '💡', text: 'برای تحلیل چک‌های خرج‌شده، روی ستون «وضعیت خرج» سورت کن.' }
    ]
});