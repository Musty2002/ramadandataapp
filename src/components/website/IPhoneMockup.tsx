interface IPhoneMockupProps {
  screenshot: string;
  alt?: string;
}

export function IPhoneMockup({ screenshot, alt = "App screenshot" }: IPhoneMockupProps) {
  return (
    <div className="relative mx-auto" style={{ width: '264px', height: '572px' }}>
      {/* iPhone Frame */}
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-800 to-zinc-900 rounded-[3rem] shadow-2xl">
        {/* Inner bezel */}
        <div className="absolute inset-[3px] bg-gradient-to-b from-zinc-700 to-zinc-800 rounded-[2.8rem]">
          {/* Screen bezel */}
          <div className="absolute inset-[3px] bg-black rounded-[2.6rem] overflow-hidden">
            {/* Dynamic Island */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 w-[90px] h-[28px] bg-black rounded-full z-20" />

            {/* Screen content */}
            <div className="absolute inset-0 overflow-hidden rounded-[2.4rem] bg-black">
              <img
                src={screenshot}
                alt={alt}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover object-top"
              />
            </div>
          </div>
        </div>
      </div>
      
      {/* Side buttons - Volume */}
      <div className="absolute left-[-2px] top-[100px] w-[3px] h-[30px] bg-zinc-700 rounded-l-sm" />
      <div className="absolute left-[-2px] top-[140px] w-[3px] h-[50px] bg-zinc-700 rounded-l-sm" />
      <div className="absolute left-[-2px] top-[200px] w-[3px] h-[50px] bg-zinc-700 rounded-l-sm" />
      
      {/* Side button - Power */}
      <div className="absolute right-[-2px] top-[150px] w-[3px] h-[70px] bg-zinc-700 rounded-r-sm" />
    </div>
  );
}
