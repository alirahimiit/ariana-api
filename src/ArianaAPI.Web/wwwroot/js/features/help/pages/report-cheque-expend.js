/* گزارش خرج چک‌ها — report-cheque-expend */
HelpRegistry.register('report-cheque-expend', {
    title: 'گزارش خرج چک‌های دریافتی',
    subtitle: 'لیست چک‌هایی که خرج شده‌اند',
    sections: [
        {
            type: 'text', icon: '💸', title: 'کار با این گزارش',
            body: `<p>همه‌ی چک‌های دریافتی که خرج شده‌اند (به حساب دیگر منتقل یا وصول شده‌اند).</p>
                 <ul>
                     <li>ستون حساب خرج‌شده: مقصد چک</li>
                     <li>وضعیت: خرج قطعی / در جریان وصول</li>
                     <li>خروجی Excel/چاپ کامل</li>
                 </ul>` }
    ]
});