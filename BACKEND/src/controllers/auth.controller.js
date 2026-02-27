import { loginUser, registerUser } from '../services/auth.service.js';



export async function login(req, res) {
  const { email, password } = req.body;
  const timestamp = new Date().toLocaleTimeString('es-ES');

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`⏰ [${timestamp}] 🔑 LOGIN ATTEMPT`);
  console.log(`📧 Email: ${email}`);
  console.log(`${'═'.repeat(60)}`);

  try {
    const result = await loginUser(email, password);
    console.log(`✅ LOGIN EXITOSO: ${email}`);
    console.log(`👤 Usuario: ${result.user.username}`);
    console.log(`🎯 Rol: ${result.user.role}`);
    console.log(`⚡ KYC Status: ${result.user.kyc_status}`);
    console.log(`${'═'.repeat(60)}\n`);
    res.json(result);
  } catch (error) {
    console.error(`❌ LOGIN ERROR (${email}):`, error.message);
    console.log(`${'═'.repeat(60)}\n`);
    res.status(401).json({ success: false, message: error.message || 'Error al iniciar sesión' });
  }
}

export async function register(req, res) {
  try {
    const { company_name, email, password } = req.body;

    if (!company_name || !email || !password) {
      return res.status(400).json({ message: 'Datos incompletos' });
    }

    const result = await registerUser(company_name, email, password);
    res.status(201).json(result);

  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}
