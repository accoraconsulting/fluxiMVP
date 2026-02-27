import bcrypt from 'bcrypt';

const passwordHash = '$2b$10$juzYiaXNPnSf368HYTNjx.FEObzkJ2Cz1qpArAY2AVb0ShyFtvAIO';
const plainPassword = '123456789';

console.log('\n🔐 Probando bcrypt.compare...\n');
console.log('Hash en BD:', passwordHash);
console.log('Contraseña plain:', plainPassword);

try {
  const isValid = await bcrypt.compare(plainPassword, passwordHash);
  console.log('\n✅ Resultado:', isValid ? 'VÁLIDO ✓' : 'INVÁLIDO ✗');
} catch (error) {
  console.error('❌ Error:', error.message);
}
