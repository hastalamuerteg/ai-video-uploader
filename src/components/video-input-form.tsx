import { FileVideo, Upload } from 'lucide-react'
import { Separator } from './ui/separator'
import { Label } from './ui/label'
import { Textarea } from './ui/textarea'
import { Button } from './ui/button'
import { ChangeEvent, FormEvent, useMemo, useRef, useState } from 'react'
import { getFFmpeg } from '@/lib/ffmpeg'
import { fetchFile } from '@ffmpeg/util'
import { api } from '@/lib/axios'

type Status = 'waiting' | 'converting' | 'uploading' | 'generating' | 'success'

const statusMessages = {
  converting: 'Convertendo...',
  uploading: 'Enviando...',
  generating: 'Transcrevendo...',
  success: 'Sucesso!'
}

interface VideoInputFormProps {
  onUploadVideo: (videoId: string) => void
}
export const VideoInputForm = ({ onUploadVideo }: VideoInputFormProps) => {
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [status, setStatus] = useState<Status>('waiting')
  const promptInputRef = useRef<HTMLTextAreaElement>(null)

  const handleFileSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const { files } = event.currentTarget
    
    if(!files) return

    const selectedFile = files[0]
    setVideoFile(selectedFile)
  }

  const previewUrl = useMemo(() => {
    if (!videoFile) return null

    return URL.createObjectURL(videoFile)
  }, [videoFile])

  const convertVideoToAudio = async (video: File) => {
    const ffmpeg = await getFFmpeg()
    await ffmpeg.writeFile('input.mp4', await fetchFile(video))

    await ffmpeg.exec([
      '-i',
      'input.mp4',
      '-map',
      '0:a',
      '-b:a',
      '20k',
      '-acodec',
      'libmp3lame',
      'output.mp3'
    ])

    const data = await ffmpeg.readFile('output.mp3')

    const audioFileBlob = new Blob([data], { type: 'audio/mpeg' })
    const audioFile = new File([audioFileBlob], 'audio.mp3', { type: 'audio/mpeg' })

    return audioFile
  }

  const handleUploadVideo = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    const prompt = promptInputRef.current?.value

    if (!videoFile) return

    setStatus('converting')

    const audioFile = await convertVideoToAudio(videoFile)
    const data = new FormData()
    data.append('file', audioFile)

    setStatus('uploading')
    const response = await api.post('/videos', data)
    const videoId = response.data.video.id
    setStatus('generating')

    await api.post(`/videos/${videoId}/transcription`, {
      prompt
    })

    setStatus('success')
    onUploadVideo(videoId)
  }

  return (
    <form onSubmit={handleUploadVideo} className="space-y-6">
      <label
        htmlFor="video"
        className="relative border flex flex-col gap-2 items-center justify-center rounded-md aspect-video cursor-pointer border-dashed text-sm text-muted-foreground hover:bg-primary/10"
        >
        {
          previewUrl ? (
            <video src={previewUrl} controls={false} className='pointer-events-none absolute inset-0 w-full h-full' />
          ) : (
            <>
              <FileVideo className="w-4 h-4" />
              Selecione um vídeo
            </>
          )
        }
      </label>
      <input type="file" id="video" accept="video/mp4" className="sr-only" onChange={handleFileSelected} />

      <Separator />
    
      <div className="space-y-2">
        <Label htmlFor="transcription_prompt">Prompt de transcrição</Label>
        <Textarea
          ref={promptInputRef}
          disabled={status !== 'waiting'}
          id="transcription_prompt"
          className="h-20 leading-relaxed resize-none"
          placeholder="Inclua palavras-chave mencionadas no vídeo separadas por vírgula (,)"
        />
      </div>
      <Button
        data-success={status === 'success'}
        disabled={status !== 'waiting'}
        type="submit"
        className="w-full data-[success=true]:bg-emerald-500"
      >
        {status === 'waiting' ? (
          <>
            Carregar vídeo
            <Upload className="w-4 h-4 ml-2" />
          </>
        ):
        statusMessages[status]
        }
      </Button>
    </form>
  )
}