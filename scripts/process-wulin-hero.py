"""
把用户上传的竖图 9:16 处理成两张：
1) hero 横图 16:9 (2400x1350) —— 适合桌面端 hero 全屏
2) hero 竖图 9:16 (1600x2848) —— 适合手机端
裁切策略：取原图中心区域（人物+客栈），再加左右两侧的延展（保留氛围）
"""
from PIL import Image, ImageFilter
import os

SRC = '/workspace/wulinwaizhuan-site/assets/images/hero_user_upload.png'
OUT_DESKTOP = '/workspace/wulinwaizhuan-site/assets/images/hero_kv_user.webp'  # 桌面端 16:9
OUT_MOBILE = '/workspace/wulinwaizhuan-site/assets/images/hero_kv_user_mobile.webp'  # 移动端 9:16
OUT_FALLBACK = '/workspace/wulinwaizhuan-site/assets/images/hero_kv.jpg'  # 当桌面端图使用

img = Image.open(SRC).convert('RGB')
W, H = img.size
print(f'原图: {W}x{H}')

# ===== 1) 桌面端 16:9 =====
# 原图 9:16，宽 1600，高 2848
# 目标 16:9，宽 2400，高 1350
# 策略：先裁出 9:16 的中间关键区域（保留两个角色和同福客栈门）作为中心，左右两侧用镜像+模糊延展
# 取中心区域：宽 1350，比例 9:16 → 高 2400
# 但原图高 2848，所以从顶部 2400 像素开始更合理（去掉一些顶部天空）
target_h = 2400  # 中心区域高度
crop_top = max(0, (H - target_h) // 2 - 100)  # 偏上一些，让中心场景在画面中
crop_top = max(0, min(crop_top, H - target_h))
center_w = int(target_h * 9 / 16)  # 1350
center_left = (W - center_w) // 2
center = img.crop((center_left, crop_top, center_left + center_w, crop_top + target_h))
print(f'中心 9:16 区域: {center.size}')

# 把中心图缩放到目标高度 1350
center_scaled = center.resize((int(1350 * 9 / 16), 1350), Image.LANCZOS)  # 759x1350
print(f'中心缩放后: {center_scaled.size}')

# 左右两侧延展：取中心图左右边缘各 80px，做镜像+高斯模糊
edge_w = 80
left_edge = center_scaled.crop((0, 0, edge_w, 1350))
right_edge = center_scaled.crop((759 - edge_w, 0, 759, 1350))
# 镜像
left_mirror = left_edge.transpose(Image.FLIP_LEFT_RIGHT)
right_mirror = right_edge.transpose(Image.FLIP_LEFT_RIGHT)
# 模糊（让边缘看起来自然）
left_mirror = left_mirror.filter(ImageFilter.GaussianBlur(radius=15))
right_mirror = right_mirror.filter(ImageFilter.GaussianBlur(radius=15))

# 目标画布 2400x1350，中心 759 居中，两侧各 820
target = Image.new('RGB', (2400, 1350), (0, 0, 0))
# 左延展：把镜像的左侧 edge 拉伸到 820 宽
left_stretched = left_mirror.resize((820, 1350), Image.LANCZOS)
right_stretched = right_mirror.resize((820, 1350), Image.LANCZOS)
target.paste(left_stretched, (0, 0))
target.paste(right_stretched, (2400 - 820, 0))
# 中心原图
center_x = (2400 - 759) // 2  # 820
target.paste(center_scaled, (center_x, 0))

# 整体再加一层柔化，让左右延展不那么明显
target = target.filter(ImageFilter.GaussianBlur(radius=0.8))
# 锐化中心
from PIL import ImageEnhance
target.save(OUT_DESKTOP, 'WEBP', quality=88, method=6)
print(f'桌面端保存: {OUT_DESKTOP} {target.size}')

# 也保留一份 jpg 备份（兼容老浏览器）
target.save(OUT_FALLBACK, 'JPEG', quality=88, optimize=True)
print(f'桌面端 jpg 备份: {OUT_FALLBACK}')

# ===== 2) 移动端 9:16 =====
# 直接用原图缩到 1200x2133（足够高清，体积小）
mobile = img.resize((1200, 2133), Image.LANCZOS)
mobile.save(OUT_MOBILE, 'WEBP', quality=88, method=6)
print(f'移动端保存: {OUT_MOBILE} {mobile.size}')

# 文件大小
for p in [OUT_DESKTOP, OUT_MOBILE, OUT_FALLBACK]:
    print(f'  {os.path.basename(p)}: {os.path.getsize(p) / 1024:.1f} KB')
