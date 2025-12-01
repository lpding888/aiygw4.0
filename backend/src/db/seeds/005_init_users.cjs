/**
 * 初始化用户数据
 * 创建测试管理员账号
 */

const crypto = require('crypto');
const bcrypt = require('bcryptjs');

/**
 * 生成 bcrypt 密码哈希
 * @param {string} password - 明文密码
 * @returns {string} bcrypt 哈希
 */
function hashPassword(password) {
  // 使用 bcrypt 同步哈希，saltRounds=10
  return bcrypt.hashSync(password, 10);
}

exports.seed = async function (knex) {
  console.log('🚀 开始初始化用户数据...');

  // 1. 清空旧数据
  await knex('users').del();

  // 2. 生成 bcrypt 密码哈希
  const hashedPassword = hashPassword('admin123');

  // 3. 准备管理员用户数据
  const adminUser = {
    id: 'admin_' + crypto.randomBytes(12).toString('hex'),
    email: 'admin@aiygw.com',
    phone: '13800138000',
    password: hashedPassword, // bcrypt 哈希
    role: 'admin',
    isMember: true,
    quota_remaining: 1000,
    quota_expireAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1年后过期
    created_at: new Date(),
    updated_at: new Date(),
  };

  // 4. 插入管理员用户
  await knex('users').insert(adminUser);

  console.log('✅ 管理员用户创建成功:');
  console.log('   邮箱: admin@aiygw.com');
  console.log('   密码: admin123');
  console.log('   角色: admin');
  console.log('   用户ID:', adminUser.id);
  console.log('');
  console.log('⚠️  注意: 这是开发环境的测试账号，生产环境请立即修改密码！');
};
