# 清除旧认证信息并重新登录

## 问题原因
- 之前的JWT token有效期只有15分钟
- 即使后端改成7天,**旧token不会自动延长有效期**
- 需要清除旧token并重新登录获取新的7天token

## 解决步骤

### 方式一:浏览器开发者工具清除(推荐)

1. 打开浏览器开发者工具 (F12)

2. **清除LocalStorage**:
   - 切换到 `Application` (Chrome) 或 `存储` (Firefox) 标签
   - 左侧找到 `Local Storage` → `http://localhost:3000`
   - 删除以下项:
     - `token`
     - `refresh_token`
     - `user`
     - `auth-storage`

3. **清除Cookies**:
   - 在同一个 `Application` 标签
   - 左侧找到 `Cookies` → `http://localhost:3000`
   - 删除以下Cookie:
     - `access_token`
     - `refresh_token`
     - `roles`
     - `auth-storage`

4. **刷新页面** (F5)

5. **重新登录**

### 方式二:浏览器控制台命令(快速)

1. 打开浏览器控制台 (F12 → Console标签)

2. 粘贴并执行以下命令:

```javascript
// 清除LocalStorage
localStorage.clear();

// 清除所有Cookie
document.cookie.split(";").forEach(function(c) {
  document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
});

// 刷新页面
location.reload();
```

3. **重新登录**

### 方式三:无痕/隐私模式(最简单)

1. 打开新的无痕窗口 (Ctrl+Shift+N)
2. 访问 `http://localhost:3000`
3. 登录

---

## 验证新Token有效期

登录成功后,在浏览器控制台执行:

```javascript
const token = localStorage.getItem('token');
const payload = JSON.parse(atob(token.split('.')[1]));
const exp = new Date(payload.exp * 1000);
const iat = new Date(payload.iat * 1000);
console.log('Token签发时间:', iat.toLocaleString());
console.log('Token过期时间:', exp.toLocaleString());
console.log('Token有效期:', Math.round((exp - iat) / (1000 * 60 * 60 * 24)), '天');
```

应该显示:
```
Token有效期: 7 天
```

如果还是显示很短的时间,说明后端没有重启或.env配置有问题。
