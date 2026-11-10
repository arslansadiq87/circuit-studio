"""Export supplied STEP geometry with its XCAF face and part colors intact."""
import json
from pathlib import Path
import cadquery as cq
from OCP.STEPCAFControl import STEPCAFControl_Reader
from OCP.TDocStd import TDocStd_Document
from OCP.TCollection import TCollection_ExtendedString,TCollection_AsciiString
from OCP.TDF import TDF_LabelSequence
from OCP.XCAFDoc import XCAFDoc_DocumentTool,XCAFDoc_ColorSurf,XCAFDoc_ColorGen,XCAFDoc_ColorCurv
from OCP.Quantity import Quantity_ColorRGBA
from OCP.BRepMesh import BRepMesh_IncrementalMesh
from OCP.RWGltf import RWGltf_CafWriter
from OCP.TColStd import TColStd_IndexedDataMapOfStringString
from OCP.Message import Message_ProgressRange

files={'ldr':'LDR12.step','stepper-24byj-48':'stepper 24BYJ-48 .STEP','dvr8825':'DVR8825.stp','sonoff-cam-s3w':'sonoff-cam-s3w.step'}
for slug,filename in files.items():
    source=Path('Custom Components')/filename
    reader=STEPCAFControl_Reader()
    reader.SetColorMode(True)
    reader.SetNameMode(True)
    if reader.ReadFile(str(source))!=1: raise RuntimeError(f'Cannot read {source}')
    doc=TDocStd_Document(TCollection_ExtendedString('XmXCAF'))
    reader.Transfer(doc)
    shape_tool=XCAFDoc_DocumentTool.ShapeTool_s(doc.Main())
    color_tool=XCAFDoc_DocumentTool.ColorTool_s(doc.Main())
    labels=TDF_LabelSequence();shape_tool.GetFreeShapes(labels)
    if labels.Length()==0:raise RuntimeError(f'No shapes in {source}')
    shapes=[cq.Shape.cast(shape_tool.GetShape_s(labels.Value(i))) for i in range(1,labels.Length()+1)]
    colors={};colored_faces=0
    for shape in shapes:
        for item in [shape,*shape.Solids(),*shape.Faces()]:
            value=Quantity_ColorRGBA()
            for kind in (XCAFDoc_ColorSurf,XCAFDoc_ColorGen,XCAFDoc_ColorCurv):
                if color_tool.GetColor(item.wrapped,kind,value):
                    rgb=value.GetRGB(); key=tuple(round(x,4) for x in (rgb.Red(),rgb.Green(),rgb.Blue(),value.Alpha()))
                    colors[key]=colors.get(key,0)+1
                    if item.geomType()=='FACE':colored_faces+=1
                    break
    for shape in shapes:BRepMesh_IncrementalMesh(shape.wrapped,.03,False,.1,True).Perform()
    output=Path(f'artifacts/{slug}-source.glb')
    writer=RWGltf_CafWriter(TCollection_AsciiString(str(output)),True)
    if not writer.Perform(doc,TColStd_IndexedDataMapOfStringString(),Message_ProgressRange()):raise RuntimeError(f'GLB export failed: {source}')
    print(json.dumps({'slug':slug,'roots':labels.Length(),'coloredFaces':colored_faces,'sourceColors':[{'rgba':k,'count':v} for k,v in colors.items()],'outputBytes':output.stat().st_size}),flush=True)
