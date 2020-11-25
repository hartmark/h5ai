<?php

class Thumb {
    private static $FFMPEG_CMDV = ['ffmpeg', '-v', 'warning', '-nostdin', '-y', '-hide_banner', '-ss', '[H5AI_DUR]', '-i', '[H5AI_SRC]', '-an', '-vframes', '1', '-f', 'image2', '-'];
    private static $FFPROBE_CMDV = ['ffprobe', '-v', 'warning', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', '[H5AI_SRC]'];
    private static $AVCONV_CMDV = ['avconv', '-v', 'warning', '-nostdin', '-y', '-hide_banner', '-ss', '[H5AI_DUR]', '-i', '[H5AI_SRC]', '-an', '-vframes', '1', '-f', 'image2', '-'];
    private static $AVPROBE_CMDV = ['avprobe', '-v', 'warning', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', '[H5AI_SRC]'];
    private static $CONVERT_CMDV = ['convert', '-density', '200', '-quality', '100', '-strip', '[H5AI_SRC][0]', 'JPG:-'];
    private static $GM_CONVERT_CMDV = ['gm', 'convert', '-density', '200', '-quality', '100', '-strip', '[H5AI_SRC][0]', 'JPG:-'];
    private static $THUMB_CACHE = 'thumbs';

    private $context;
    private $setup;
    private $thumbs_path;
    private $thumbs_href;
    private $capture_data;
    private $image;
    private $valid_capture;

    public function __construct($context, $source_path, $type) {
        $this->context = $context;
        $this->setup = $context->get_setup();
        $this->thumbs_path = $this->setup->get('CACHE_PUB_PATH') . '/' . Thumb::$THUMB_CACHE;
        $this->thumbs_href = $this->setup->get('CACHE_PUB_HREF') . Thumb::$THUMB_CACHE;
        $this->source_path = $source_path;
        $this->type = $type;
        $this->source_hash = sha1($source_path);
        $this->capture_data = false;
        $this->thumb_path = null;
        $this->thumb_href = null;
        $this->image = null;
        $this->valid_capture = false;

        if (!is_dir($this->thumbs_path)) {
            @mkdir($this->thumbs_path, 0755, true);
        }
    }

    public function thumb($width, $height) {
        if (!file_exists($this->source_path) || Util::starts_with($this->source_path, $this->setup->get('CACHE_PUB_PATH'))) {
            return null;
        }
        $name = 'thumb-' . $this->source_hash . '-' . $width . 'x' . $height . '.jpg';
        $this->thumb_path = $this->thumbs_path . '/' . $name;
        $this->thumb_href = $this->thumbs_href . '/' . $name;

        if (file_exists($this->thumb_path) && filemtime($this->source_path) <= filemtime($this->thumb_path)) {
            if ($this->type === 'file') {
                // This was previously detected as able to generate thumbnail
                $this->type = 'done';
            }
            return $this->thumb_href;
        }
        if ($this->valid_capture) {
            return $this->thumb_href($width, $height);
        }

        // Handle to the capture file
        $fiveMBs = 2 * 1024 * 1024;
        $this->capture_data = fopen("php://temp/maxmemory:$fiveMBs", 'r+');

        $type = $this->type;
        $types = array('img', 'mov', 'doc', 'swf');
        // Only keep the types remaining to test in this array
        $key = array_search($type, $types);
        if ($key !== false) {
            unset($types[$key]);
            // Reset indices starting from 0
            $types = array_values($types);
        }
        $types_count = count($types);
        // $this->context->write_log("Types".$types_count." for ".$this->source_path." of type ".$type." : ".print_r($types, true));
        $thumb = null;
        $attempt = 0;
        do {
            $this->context->write_log("\nDO: ".$this->source_path."\ntype: ".$type."\nattempt: ".$attempt."\n");
            if ($type === 'img') {
                $exiftype = exif_imagetype($this->source_path);
                if ($exiftype === 4) {  // IMAGETYPE_SWF
                    $type = 'swf';
                    continue;
                }
                elseif ($exiftype !== false) {
                    // $this->capture($type);
                    $thumb = $this->thumb_href($width, $height);
                }
                if (!is_null($thumb)) {
                    $this->type = $type;
                    // Avoid future type detection if we have generated a valid one already
                    $this->valid_capture = true;
                    break;
                }
            }
            elseif (($type === 'mov') || ($type === 'swf')) {
                try {
                    if ($this->setup->get('HAS_CMD_AVCONV')) {
                        $this->capture(Thumb::$AVCONV_CMDV, $type);
                    } elseif ($this->setup->get('HAS_CMD_FFMPEG')) {
                        $this->capture(Thumb::$FFMPEG_CMDV, $type);
                    }
                } catch (Exception $e) {
                    $this->context->write_log($this->source_path.$e);
                }
            }
            elseif ($type === 'doc') {
                try {
                    if ($this->setup->get('HAS_CMD_CONVERT')) {
                        $this->capture(Thumb::$CONVERT_CMDV, $type);
                    } elseif ($this->setup->get('HAS_CMD_GM')) {
                        $this->capture(Thumb::$GM_CONVERT_CMDV, $type);
                    }
                } catch (Exception $e) {
                    $this->context->write_log($this->source_path.$e);
                }
            }
            elseif ($this->setup->get('HAS_PHP_FILEINFO')) {
                // Last resort, we check the magic number
                $type = Util::mime_to_type(Util::get_mimetype($this->source_path));
                $this->context->write_log("\nDETECT: ".$this->source_path."\ntype: ".$type."\nattempt: ".$attempt."\n");
                if ($type === 'file') {
                    // No further try after this
                    $this->type = $type;
                    break;
                }
                continue;
            }
            else {
                return null;
            }
            if ($this->valid_capture && is_null($thumb)) {
                $thumb = $this->thumb_href($width, $height);
            }

            if (!is_null($thumb)) {
                // Validate the type
                $this->type = $type;
                $this->context->write_log("\nThumb ".$thumb." was generated for ". $this->source_path." and type is indeed: ".$this->type."\n");
                break;
            }
            // Get the next type to try
            $type = $types[$attempt];
            $attempt++;
            $this->context->write_log("\nattempt++ Source: ".$this->source_path."\nthumb: ".$thumb."\ntype: ".$type."\nattempt: ".$attempt."/".$types_count."\nprevious type from array: ".print_r($types[$attempt - 1], true)."\n");
        } while(is_null($thumb) /*&& !$this->valid_capture*/ && $attempt < $types_count);

        return $thumb;
    }

    private function thumb_href($width, $height) {
        // $image =& $this->image;
        if ($this->image === null) {
            $this->image = new Image();

            if (!$this->valid_capture) {
                // We assume $this->source_path points to an image file
                $et = false;
                if ($this->setup->get('HAS_PHP_EXIF') && $this->context->query_option('thumbnails.exif', false) === true && $height != 0) {
                    $et = @exif_thumbnail($this->source_path);
                }
                if($et !== false) {
                    // FIXME keep the handle and pass it to $image instead of closing it here
                    // file_put_contents($this->thumb_path, $et);
                    rewind($this->capture_data);
                    fwrite($this->capture_data, $et);
                    $this->valid_capture = true;

                    $this->image->set_source_data($this->capture_data);
                    $this->image->normalize_exif_orientation($this->source_path);
                } else {
                    rewind($this->capture_data);
                    $input_image  = fopen($this->thumb_path, 'r');
                    stream_copy_to_stream($input_image, $this->capture_data);
                    $this->valid_capture = true;
                    fclose($input_image);

                    $this->image->set_source_data($this->$capture_data);
                }
            } else {
                $this->image->set_source_data($this->capture_data);
            }
        }
        $this->image->thumb($width, $height);
        $this->image->save_dest_jpeg($this->thumb_path, 80);

        if (file_exists($this->thumb_path)) {
            // Cache it for further requests
            // $this->image = &$image;
            return $this->thumb_href;
        }
        // return file_exists($this->thumb_path) ? $this->thumb_href : null;
        unset($this->image);
        $this->image = null;
        return null;
    }

    private function capture($cmdv, $type) {
        if ($type === 'doc') {
            foreach ($cmdv as &$arg) {
                $arg = str_replace('[H5AI_SRC]', $this->source_path, $arg);
            }
        } else {
            $timestamp = '0.1';
            if ($cmdv[0] === 'ffmpeg') {
                $timestamp = $this->compute_duration(Thumb::$FFPROBE_CMDV, $this->source_path);
            } else {
                $timestamp = $this->compute_duration(Thumb::$AVPROBE_CMDV, $this->source_path);
            }

            // Seeking should be done after decoding
            if ($type === 'swf'){
                $cmdv[6] = '-i';
                $cmdv[7] = '[H5AI_SRC]';
                $cmdv[8] = '-ss';
                $cmdv[9] = '[H5AI_DUR]';
            }
            foreach ($cmdv as &$arg) {
                $arg = str_replace(
                    ['[H5AI_SRC]', '[H5AI_DUR]'],
                    [$this->source_path, $timestamp],
                    $arg
                );
            }
        }
        $error = null;
        $exit = Util::proc_open_cmdv($cmdv, $this->capture_data, $error);
        $this->context->write_log("$this->source_path cmdv: ".implode(" ", $cmdv));

        // Make sure our output is a valid image
        rewind($this->capture_data);
        $data = fread($this->capture_data, 3);
        $this->context->write_log("$this->source_path ERROR: $error DATA HEADER:".bin2hex($data));
        // Instead of parsing the child process' stderror stream for actual errors,
        // simply make sure the stdout stream start with the JPEG magic number
        $image = (!empty($data)) ? (bin2hex($data) === 'ffd8ff') : false;
        $this->context->write_log("$this->source_path Valid type? ".($image ? "true" : "false"));
        $this->valid_capture = $image;

        if (!$image){
            throw new Exception($error);
        }

        if ($type === 'doc') {
            // $img = imagecreatefromstring($this->capture_data);

            // $filename = $this->setup->get('CACHE_PUB_PATH').'/'.sha1($this->source_path);
            // imagejpeg($img, $filename, 50);
            // $fp = fopen($filename, 'w');
            // fwrite($fp, $this->capture_data);
            // fclose($fp);
            // @chmod($filename, 0775);
            return True;
        }
        return False;
    }

    private function compute_duration($cmdv, $source_path) {
        foreach ($cmdv as &$arg) {
            $arg = str_replace('[H5AI_SRC]', $source_path, $arg);
        }

        $output = null;
        $error = null;
        $exit = Util::proc_open_cmdv($cmdv, $output, $error);
        if (empty($output) || !is_numeric($output) || is_infinite($output)) {
            if (!empty($error) && strpos($error, 'misdetection possible') !== false) {
                throw new Exception($error);
            }
            return '0.1';
        }
        // Seek at 15% of the total video duration
        return strval(round(((floatval($output) * 15) / 100), 1, PHP_ROUND_HALF_UP));
    }
}

class Image {
    private $source_file;
    private $source;
    private $width;
    private $height;
    private $type;
    private $dest;

    public function __construct($filename = null) {
        $this->source_file = null;
        $this->source = null;
        $this->width = null;
        $this->height = null;
        $this->type = null;

        $this->dest = null;

        $this->set_source($filename);
    }

    public function __destruct() {
        $this->release_source();
        $this->release_dest();
    }

    public function set_source($filename) {
        $this->release_source();
        $this->release_dest();

        if (is_null($filename)) {
            return;
        }
        $this->source_file = $filename;

        list($this->width, $this->height, $this->type) = @getimagesize($this->source_file);

        if (!$this->width || !$this->height) {
            $this->source_file = null;
            $this->width = null;
            $this->height = null;
            $this->type = null;
            return;
        }

        $this->source = imagecreatefromstring(file_get_contents($this->source_file));
    }

    public function set_source_data($fp) {
        $this->release_dest();

        $this->source_file = $fp;
        rewind($fp);
        $this->source = imagecreatefromstring(stream_get_contents($fp));
        // fclose($fp);

        // $this->source = imagecreatefromstring($data);
        Util::write_log("\nDATA: ".$this->source_file." ".$this->source);

        $this->width = imagesx($this->source);
        $this->height = imagesy($this->source);
        $this->type = null;

        if (!$this->width || !$this->height) {
            $this->source_file = null;
            $this->width = null;
            $this->height = null;
            $this->type = null;
            return;
        }

    }

    public function save_dest_jpeg($filename, $quality = 80) {
        Util::write_log("\nSAVE_DEST: ".$this->source_file." to ".$filename);
        if (!is_null($this->dest)) {
            @imagejpeg($this->dest, $filename, $quality);
            @chmod($filename, 0775);
        }
    }

    public function release_dest() {
        if (!is_null($this->dest)) {
            @imagedestroy($this->dest);
            $this->dest = null;
        }
    }

    public function release_source() {
        if (!is_null($this->source)) {
            @imagedestroy($this->source);
            $this->source_file = null;
            $this->source = null;
            $this->width = null;
            $this->height = null;
            $this->type = null;
        }
    }

    public function thumb($width, $height) {
        if (is_null($this->source)) {
            return;
        }

        $src_r = 1.0 * $this->width / $this->height;

        if ($height == 0) {
            if ($src_r >= 1) {
                $height = 1.0 * $width / $src_r;
            } else {
                $height = $width;
                $width = 1.0 * $height * $src_r;
            }
            if ($width > $this->width) {
                $width = $this->width;
                $height = $this->height;
            }
        }

        $ratio = 1.0 * $width / $height;

        if ($src_r <= $ratio) {
            $src_w = $this->width;
            $src_h = $src_w / $ratio;
            $src_x = 0;
        } else {
            $src_h = $this->height;
            $src_w = $src_h * $ratio;
            $src_x = 0.5 * ($this->width - $src_w);
        }

        $width = intval($width);
        $height = intval($height);
        $src_x = intval($src_x);
        $src_w = intval($src_w);
        $src_h = intval($src_h);

        $this->dest = imagecreatetruecolor($width, $height);
        $icol = imagecolorallocate($this->dest, 255, 255, 255);
        imagefill($this->dest, 0, 0, $icol);
        imagecopyresampled($this->dest, $this->source, 0, 0, $src_x, 0, $width, $height, $src_w, $src_h);
    }

    public function rotate($angle) {
        if (is_null($this->source) || ($angle !== 90 && $angle !== 180 && $angle !== 270)) {
            return;
        }

        //FIXME once rotated, prevent further rotations since we keep $this->source in memory
        $this->source = imagerotate($this->source, $angle, 0);
        if ( $angle === 90 || $angle === 270 ) {
            list($this->width, $this->height) = [$this->height, $this->width];
        }
    }

    public function normalize_exif_orientation($exif_source_file = null) {
        if (is_null($this->source) || !function_exists('exif_read_data')) {
            return;
        }

        if ($exif_source_file === null) {
            $exif_source_file = $this->source_file;
        }

        $exif = exif_read_data($exif_source_file);
        switch (@$exif['Orientation']) {
            case 3:
                $this->rotate(180);
                break;
            case 6:
                $this->rotate(270);
                break;
            case 8:
                $this->rotate(90);
                break;
        }
    }
}
