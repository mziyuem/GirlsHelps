@echo off
echo ========================================
echo    Girls Help 云开发部署脚本
echo ========================================
echo.

echo [1/4] 检查微信开发者工具...
where cli 2>nul
if %errorlevel% neq 0 (
    echo ❌ 未找到微信开发者工具 CLI，请确保已安装并添加到 PATH
    echo 请参考：https://developers.weixin.qq.com/miniprogram/dev/devtools/cli.html
    pause
    exit /b 1
)

echo ✅ 微信开发者工具 CLI 可用
echo.

echo [2/4] 上传云函数...
echo 正在上传所有云函数，请稍候...

cli cloudfunctions:upload --functions login,createHelpRequest,getHelpRequestStatus,cancelHelpRequest,completeHelp,getNearbyUsers,getUserProfile,updateUserResources,updatePrivacySetting,updateUserLocation,contactUser,emotionSupport,initDatabase

if %errorlevel% neq 0 (
    echo ❌ 云函数上传失败
    pause
    exit /b 1
)

echo ✅ 云函数上传成功
echo.

echo [3/4] 初始化数据库...
echo 正在初始化数据库和添加测试数据...

cli cloudfunctions:invoke --name initDatabase

if %errorlevel% neq 0 (
    echo ❌ 数据库初始化失败
    pause
    exit /b 1
)

echo ✅ 数据库初始化完成
echo.

echo [4/4] 部署完成！
echo.
echo ========================================
echo 🎉 部署成功！
echo.
echo 下一步操作：
echo 1. 在微信开发者工具中运行小程序
echo 2. 首次运行会自动跳转到登录页面
echo 3. 完成登录后即可使用所有功能
echo.
echo 如果遇到问题，请检查：
echo - 云环境ID是否正确配置
echo - 数据库集合权限是否正确设置
echo - 云函数是否都已上传成功
echo ========================================

pause
