/* فرم خرج چک — cheque-expend-form */
HelpRegistry.register('cheque-expend-form', {
    title: 'فرم خرج چک',
    subtitle: 'خرج کردن یک چک دریافتی',
    sections: [
        {
            type: 'text', icon: '📖', title: 'مراحل',
            body: `<ol>
                     <li>دکمه <b>🔍 انتخاب چک (F2)</b> را بزن</li>
                     <li>یک چک از لیست انتخاب کن (فقط چک‌های آزاد و در جریان)</li>
                     <li>شماره/تاریخ رسید و شرح را وارد کن</li>
                     <li>حساب بستانکار/بدهکار را تنظیم کن (F3 / F5 برای پیش‌فرض)</li>
                     <li>سند خودکار را چک بزن یا شماره سند موجود را انتخاب کن</li>
                     <li>ذخیره کن</li>
                 </ol>` },
        {
            type: 'keys', icon: '⌨️', items: [
                { keys: 'F2', desc: 'انتخاب چک' },
                { keys: 'F3', desc: 'بستانکاران پیش‌فرض' },
                { keys: 'F5', desc: 'اسناد دریافتنی پیش‌فرض' },
                { keys: 'F9', desc: 'ذخیره' },
                { keys: 'Esc', desc: 'بستن' }
            ]
        }
    ]
});