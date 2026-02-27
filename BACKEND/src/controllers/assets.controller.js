import { execute } from '../config/crate.js';

/**
 * Obtener todos los activos disponibles
 */
export async function getAssets(req, res) {
  try {
    const { rows } = await execute(`
      SELECT 
        id,
        symbol,
        name,
        is_active,
        created_at
      FROM doc.assets
      WHERE is_active = true
      ORDER BY symbol ASC
    `);

    res.json(rows);
  } catch (error) {
    console.error('[AssetsController] Error obteniendo activos:', error);
    res.status(500).json({ 
      error: 'Error obteniendo activos',
      message: error.message 
    });
  }
}

/**
 * Obtener activo por símbolo
 */
export async function getAssetBySymbol(req, res) {
  try {
    const { symbol } = req.params;

    const { rows } = await execute(`
      SELECT 
        id,
        symbol,
        name,
        is_active,
        created_at
      FROM doc.assets
      WHERE symbol = $1
    `, [symbol]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Activo no encontrado' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('[AssetsController] Error obteniendo activo:', error);
    res.status(500).json({ 
      error: 'Error obteniendo activo',
      message: error.message 
    });
  }
}
