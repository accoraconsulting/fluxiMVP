/**
 * ADMIN SERVICE
 * Funciones exclusivas para administradores
 */

import { execute } from '../config/crate.js';
import { randomUUID } from 'crypto';

/**
 * Obtener estadísticas globales de la plataforma
 */
export async function getPlatformStats() {
  try {
    // Total de usuarios (sin filtro is_active, solo por status)
    const { rows: userRows } = await execute(
      `SELECT COUNT(*) as total FROM doc.users WHERE status = 'active'`
    );

    // Total por rol
    const { rows: roleRows } = await execute(
      `SELECT role, COUNT(*) as count 
       FROM doc.users 
       WHERE status = 'active'
       GROUP BY role`
    );

    // Total de wallets activas
    const { rows: walletRows } = await execute(
      `SELECT COUNT(*) as total FROM doc.wallets WHERE is_active = true`
    );

    // Total de transacciones
    const { rows: txRows } = await execute(
      `SELECT COUNT(*) as total FROM doc.transactions`
    );

    // Volumen total por moneda
    const { rows: volumeRows } = await execute(
      `SELECT 
        a.symbol,
        SUM(CASE WHEN wm.amount > 0 THEN wm.amount ELSE 0 END) as total_in,
        SUM(CASE WHEN wm.amount < 0 THEN ABS(wm.amount) ELSE 0 END) as total_out
       FROM doc.wallet_movements wm
       JOIN doc.wallets w ON wm.wallet_id = w.id
       JOIN doc.assets a ON w.asset_id = a.id
       GROUP BY a.symbol`
    );

    // KYC stats
    const { rows: kycRows } = await execute(
      `SELECT kyc_status, COUNT(*) as count 
       FROM doc.users 
       GROUP BY kyc_status`
    );

    return {
      users: {
        total: parseInt(userRows[0].total),
        byRole: roleRows.map(r => ({
          role: r.role,
          count: parseInt(r.count)
        }))
      },
      wallets: {
        total: parseInt(walletRows[0].total)
      },
      transactions: {
        total: parseInt(txRows[0].total)
      },
      volume: volumeRows.map(v => ({
        currency: v.symbol,
        totalIn: parseFloat(v.total_in),
        totalOut: parseFloat(v.total_out)
      })),
      kyc: kycRows.map(k => ({
        status: k.kyc_status,
        count: parseInt(k.count)
      }))
    };

  } catch (error) {
    console.error('[AdminService] Error obteniendo stats:', error);
    throw new Error('Error obteniendo estadísticas');
  }
}

/**
 * Listar todos los usuarios con detalles
 */
export async function getAllUsers(filters = {}) {
  try {
    let query = `
      SELECT 
        u.id,
        u.email,
        u.username,
        u.role,
        u.kyc_status,
        u.status,
        u.created_at,
        u.updated_at
      FROM doc.users u
      WHERE 1=1
    `;

    const params = [];

    if (filters.role) {
      query += ` AND u.role = $${params.length + 1}`;
      params.push(filters.role);
    }

    if (filters.kycStatus) {
      query += ` AND u.kyc_status = $${params.length + 1}`;
      params.push(filters.kycStatus);
    }

    if (filters.status) {
      query += ` AND u.status = $${params.length + 1}`;
      params.push(filters.status);
    }

    if (filters.search) {
      query += ` AND (u.email ILIKE $${params.length + 1} OR u.username ILIKE $${params.length + 1})`;
      params.push(`%${filters.search}%`);
    }

    query += ` ORDER BY u.created_at DESC`;

    if (filters.limit) {
      query += ` LIMIT $${params.length + 1}`;
      params.push(parseInt(filters.limit));
    }

    const { rows } = await execute(query, params);

    // Para cada usuario, obtener sus wallets
    const usersWithWallets = await Promise.all(
      rows.map(async (user) => {
        const { rows: walletRows } = await execute(
          `SELECT 
            w.id,
            w.balance,
            w.is_active,
            a.symbol,
            a.name
           FROM doc.wallets w
           JOIN doc.assets a ON w.asset_id = a.id
           WHERE w.user_id = $1
           ORDER BY a.symbol`,
          [user.id]
        );

        return {
          ...user,
          wallets: walletRows.map(w => ({
            id: w.id,
            symbol: w.symbol,
            name: w.name,
            balance: parseFloat(w.balance),
            isActive: w.is_active
          }))
        };
      })
    );

    return usersWithWallets;

  } catch (error) {
    console.error('[AdminService] Error obteniendo usuarios:', error);
    throw new Error('Error obteniendo usuarios');
  }
}

/**
 * Obtener detalles de un usuario específico
 */
export async function getUserDetails(userId) {
  try {
    // Info del usuario
    const { rows: userRows } = await execute(
      `SELECT * FROM doc.users WHERE id = $1 LIMIT 1`,
      [userId]
    );

    if (userRows.length === 0) {
      throw new Error('Usuario no encontrado');
    }

    const user = userRows[0];

    // Wallets del usuario
    const { rows: walletRows } = await execute(
      `SELECT 
        w.id,
        w.balance,
        w.is_active,
        w.created_at,
        a.symbol,
        a.name
       FROM doc.wallets w
       JOIN doc.assets a ON w.asset_id = a.id
       WHERE w.user_id = $1
       ORDER BY a.symbol`,
      [userId]
    );

    // Últimas transacciones
    const { rows: txRows } = await execute(
      `SELECT 
        t.id,
        t.amount,
        t.tx_hash,
        t.created_at,
        ts.name as status,
        a.symbol
       FROM doc.transactions t
       JOIN doc.wallets w ON t.wallet_id = w.id
       JOIN doc.assets a ON w.asset_id = a.id
       JOIN doc.transaction_status ts ON t.status_id = ts.id
       WHERE w.user_id = $1
       ORDER BY t.created_at DESC
       LIMIT 20`,
      [userId]
    );

    return {
      user,
      wallets: walletRows.map(w => ({
        id: w.id,
        symbol: w.symbol,
        name: w.name,
        balance: parseFloat(w.balance),
        isActive: w.is_active,
        createdAt: w.created_at
      })),
      recentTransactions: txRows.map(t => ({
        id: t.id,
        amount: parseFloat(t.amount),
        txHash: t.tx_hash,
        status: t.status,
        currency: t.symbol,
        createdAt: t.created_at
      }))
    };

  } catch (error) {
    console.error('[AdminService] Error obteniendo detalles:', error);
    throw error;
  }
}

/**
 * Bloquear/desbloquear usuario
 */
export async function toggleUserStatus(userId, newStatus) {
  try {
    const validStatuses = ['active', 'blocked', 'suspended'];

    if (!validStatuses.includes(newStatus)) {
      throw new Error('Estado no válido');
    }

    await execute(
      `UPDATE doc.users 
       SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [newStatus, userId]
    );

    await execute('REFRESH TABLE doc.users');

    return { userId, newStatus };

  } catch (error) {
    console.error('[AdminService] Error cambiando status:', error);
    throw error;
  }
}

/**
 * Bloquear/desbloquear wallet
 */
export async function toggleWalletStatus(walletId, isActive) {
  try {
    await execute(
      `UPDATE doc.wallets 
       SET is_active = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [isActive, walletId]
    );

    await execute('REFRESH TABLE doc.wallets');

    return { walletId, isActive };

  } catch (error) {
    console.error('[AdminService] Error cambiando wallet status:', error);
    throw error;
  }
}

/**
 * Obtener todas las transacciones de la plataforma
 */
export async function getAllTransactions(filters = {}) {
  try {
    let query = `
      SELECT 
        t.id,
        t.amount,
        t.tx_hash,
        t.created_at,
        ts.name as status,
        a.symbol,
        u.email as user_email,
        u.username
      FROM doc.transactions t
      JOIN doc.wallets w ON t.wallet_id = w.id
      JOIN doc.users u ON w.user_id = u.id
      JOIN doc.assets a ON w.asset_id = a.id
      JOIN doc.transaction_status ts ON t.status_id = ts.id
      WHERE 1=1
    `;

    const params = [];

    if (filters.currency) {
      query += ` AND a.symbol = $${params.length + 1}`;
      params.push(filters.currency);
    }

    if (filters.userId) {
      query += ` AND u.id = $${params.length + 1}`;
      params.push(filters.userId);
    }

    query += ` ORDER BY t.created_at DESC`;

    if (filters.limit) {
      query += ` LIMIT $${params.length + 1}`;
      params.push(parseInt(filters.limit));
    } else {
      query += ` LIMIT 100`;
    }

    const { rows } = await execute(query, params);

    return rows.map(t => ({
      id: t.id,
      amount: parseFloat(t.amount),
      txHash: t.tx_hash,
      status: t.status,
      currency: t.symbol,
      userEmail: t.user_email,
      username: t.username,
      createdAt: t.created_at
    }));

  } catch (error) {
    console.error('[AdminService] Error obteniendo transacciones:', error);
    throw new Error('Error obteniendo transacciones');
  }
}