library(circular)
library(ggplot2)

# ----------------------------------------
# ① フォルダ選択（Windows）
# ----------------------------------------
folder <- choose.dir()
if (is.na(folder)) stop("フォルダが選択されていません。")

# CSV一覧
files <- list.files(folder, pattern="\\.csv$", full.names = TRUE)
if (length(files) == 0) stop("フォルダに CSV がありません。")

# ----------------------------------------
# ② 一括処理ループ
# ----------------------------------------
for (file_path in files) {
  
  # CSV読み込み
  data <- read.csv(file_path)
  
  if (!"Angle" %in% names(data)) {
    message("スキップ（Angle列なし）: ", basename(file_path))
    next
  }
  
  angles <- data$Angle   # 0-180°
  
  # 0–180° → 360°の軸方向データへ展開
  angles360 <- (angles * 2) %% 360
  
  # circular形式へ
  circular_data <- circular(
    angles360,
    type = "angles",
    units = "degrees",
    template = "geographics",
    modulo = "2pi",
    zero = pi/2,         # 北を0°
    rotation = "clock"   # 時計回り
  )
  
  rose_df <- data.frame(angle = as.numeric(circular_data))
  
  # 階級幅
  bin_width <- 10
  
  # プロット作成
  rose_plot <- ggplot(rose_df, aes(x = angle)) +
    geom_histogram(
      breaks = seq(0, 360, by = bin_width),
      aes(y = ..count..),
      fill = "#0072B2",
      color = "black",
      closed = "left"
    ) +
    coord_polar(start = 0, direction = -1) +  # 北=上、時計回り
    scale_x_continuous(
      limits = c(0, 360),
      breaks = seq(0, 330, 30)
    ) +
    labs(
      title = paste0("粒子配向ローズダイアグラム（", bin_width, "°階級）"),
      subtitle = paste("ファイル:", basename(file_path),
                       " / データ数:", length(angles)),
      x = NULL, y = NULL
    ) +
    theme_minimal() +
    theme(
      panel.grid.major.x = element_line(linetype = "dashed", color = "gray80"),
      panel.grid.major.y = element_line(linetype = "dotted", color = "gray80"),
      axis.text.x = element_text(size = 10, face = "bold")
    )
  
  # ----------------------------------------------------------
  # ③ PNG 保存
  # ----------------------------------------------------------
  out_name <- paste0(tools::file_path_sans_ext(basename(file_path)), "_rose.png")
  out_path <- file.path(folder, out_name)
  
  ggsave(out_path, rose_plot, width = 6, height = 6, dpi = 300)
  
  message("保存完了：", out_path)
}

message("\n=== すべての CSV を PNG 化しました！ ===")
