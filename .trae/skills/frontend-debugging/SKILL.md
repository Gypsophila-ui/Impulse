---
name: "frontend-debugging"
description: "专业的前端调试助手，帮助开发者快速定位和解决前端开发中的各种问题。包括渲染失败、网络请求、React组件、TypeScript类型、性能优化等。Invoke when user asks about frontend debugging, troubleshooting, or optimization."
---

# Frontend Debugging Assistant

## 核心能力
- 渲染失败问题排查
- 网络请求调试  
- React 组件调试
- TypeScript 类型排查
- 性能问题分析
- Chrome DevTools 使用技巧

## 工作流程
1. **问题诊断**：根据错误现象快速定位问题类型
2. **工具推荐**：推荐合适的调试工具和方法
3. **步骤指导**：提供具体的排查步骤
4. **解决方案**：给出修复建议和最佳实践

## 调试工具集

### Console 调试
```javascript
// 基础调试
console.log("普通信息")
console.warn("警告")  
console.error("错误")
console.debug("调试信息")

// 条件断点
debugger  // 代码执行到这里自动暂停
```

### React 组件调试
```javascript
// React DevTools 使用
// 组件树可视化，检查 props/state/hooks

// 强制重渲染排查
<Component key={Math.random()} />

// Profiler 性能分析
// DevTools → Profiler → 记录 → 查看重复渲染
```

### 网络请求排查
```javascript
// DevTools → Network → 勾选 Preserve log
fetch(url).then(res => {
  console.log('Status:', res.status)  // 200/404/500
  console.log('Headers:', [...res.headers])
})
```

## 常见问题速查表

| 问题现象 | 可能原因 | 解决方案 |
|---------|---------|---------|
| 页面空白 | JS 报错 / 路由未匹配 | Console 查错 / 检查路由配置 |
| 点击无反应 | 事件未绑定 / 条件不满足 | 检查 onClick / 条件渲染 |
| 数据不更新 | 状态未正确 set / 依赖缺失 | 检查 setState / useEffect |
| 样式丢失 | CSS 未加载 / 选择器优先级 | 检查 link 标签 / specificity |
| 请求失败 | CORS / 参数错误 / 401 | 检查 Network 面板 |
| 卡顿 | 大量计算 / 无限循环 | Profiler 定位 / 检查 useEffect |

## Chrome DevTools 快捷键
- `F12` / `Cmd+Opt+I` - 打开 DevTools
- `Cmd+Shift+P` - 命令面板
- `Cmd+Shift+F` - 全局搜索文件内容
- `Cmd+P` - 快速打开文件
- `Cmd+L` - 清空 Console

## TypeScript 类型排查
```typescript
// 类型收窄
function process(value: string | number) {
  if (typeof value === 'string') {
    return value.toUpperCase()  // TS 知道是 string
  }
  return value.toFixed(2)       // TS 知道是 number
}

// 类型断言（临时绕过）
(document.getElementById('app') as HTMLElement).innerHTML
```

## 性能优化技巧
```typescript
// React.memo 避免不必要重渲染
const MemoizedComponent = React.memo(Component)

// useMemo / useCallback 优化
const memoized = useMemo(() => compute(a, b), [a, b])
const callback = useCallback(() => fn(a, b), [a])

// 虚拟列表（大列表优化）
import { FixedSizeList } from 'react-window'
```

## 使用场景
- "页面白屏了怎么办？"
- "React 组件不更新状态"
- "TypeScript 类型报错"
- "网络请求失败"
- "页面卡顿如何优化"
- "Chrome DevTools 怎么用"

## 调试工作流最佳实践

```
1. 复现问题
   └── 明确必现步骤
   
2. 定位范围
   ├── Console 错误？
   ├── Network 请求？
   ├── React 组件树？
   └── 断点调试
   
3. 提出假设
   └── "可能是 X 导致了 Y"
   
4. 验证排除
   ├── 注释代码验证
   ├── 简化复现案例
   └── 对比正常/异常状态
   
5. 修复验证
   └── 重新测试原步骤
```

## 响应语言
- 默认使用用户提问的语言
- 代码注释和示例保持与用户语言一致
- 技术术语保持英文原词，便于搜索和理解