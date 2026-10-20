"""Run: LPF_TEST_FFMPEG=/path/to/ffmpeg python tests/shorts_export_test.py."""
import importlib.util
import hashlib
import os
from pathlib import Path
import shutil
import sys
import tempfile
import unittest
sys.dont_write_bytecode=True
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('shorts_export',ROOT/'hosted/public/shorts-export.py')
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
FFMPEG=os.environ.get('LPF_TEST_FFMPEG') or shutil.which('ffmpeg')

class ExportTests(unittest.TestCase):
    def setUp(self):
        self.source=ROOT/'tests/fixtures/shorts-source.mp4'
        self.plan={'version':1,'recordingId':'test','clipId':'clip','source':{'size':self.source.stat().st_size,'duration':15},
                   'start':2,'end':14,'hook':'A REAL PIANO CHALLENGE','context':'Schmitt · 3 loops','hookVisible':True,'contextVisible':True,
                   'evidence':{'climax':7,'payoff':13.5,'kind':'victory'}}
    def test_rejects_wrong_files_and_missing_payoff(self):
        with tempfile.TemporaryDirectory() as folder:
            output=Path(folder)/'short.mp4';info={'width':1080,'height':1920,'duration':15}
            module.validate(self.plan,self.source,output,info)
            with self.assertRaisesRegex(ValueError,'vertical'):
                module.validate(self.plan,self.source,output,{**info,'width':1920,'height':1080})
            with self.assertRaisesRegex(ValueError,'payoff'):
                module.validate({**self.plan,'end':8},self.source,output,info)
            with self.assertRaisesRegex(ValueError,'file size'):
                module.validate({**self.plan,'source':{'size':1}},self.source,output,info)
            with self.assertRaisesRegex(ValueError,'overwritten'):
                module.validate(self.plan,self.source,self.source,info)
    @unittest.skipUnless(FFMPEG,'Set LPF_TEST_FFMPEG to exercise the real encoder')
    def test_real_mp4_export_audio_and_source_integrity(self):
        original=hashlib.sha256(self.source.read_bytes()).hexdigest()
        with tempfile.TemporaryDirectory() as folder:
            output=Path(folder)/'short.mp4'
            report=module.export(self.plan,self.source,output,FFMPEG)
            self.assertEqual((report['media']['width'],report['media']['height']),(1080,1920))
            self.assertEqual(report['media']['fps'],60)
            self.assertAlmostEqual(report['media']['duration'],12,places=1)
            self.assertTrue(report['media']['audio'])
            with self.assertRaisesRegex(ValueError,'overwritten'):
                module.export(self.plan,self.source,output,FFMPEG)
        self.assertEqual(hashlib.sha256(self.source.read_bytes()).hexdigest(),original)

if __name__=='__main__':unittest.main()
