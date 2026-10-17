"""Double-click entry point: python app.py [files...]"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

if __name__ == "__main__":
    try:
        from p2w.gui import main
    except ImportError as e:                 # no console under pythonw: say it in a box
        import tkinter
        from tkinter import messagebox
        tkinter.Tk().withdraw()
        messagebox.showerror("缺少组件", f"{e}\n\n请先运行 setup.bat 安装依赖。")
        sys.exit(1)
    main(sys.argv[1:])
