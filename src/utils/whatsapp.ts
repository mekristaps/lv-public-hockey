export const sendWhatsAppMessage = (phone: string, pin: string) => {
    let cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length === 8) cleanPhone = '371' + cleanPhone;
    const currentURL = window.location.href;
    const msg = `Masu hokeja lietotnes PIN: ${pin}, ${currentURL}`;
    const encodedMsg = encodeURIComponent(msg);
    window.location.href = `https://wa.me/${cleanPhone}?text=${encodedMsg}`;
};