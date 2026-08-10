import java.util.*;

// 입국심사를 기다리는 사람은 1명 이상 1,000,000,000명 이하입니다.
// 각 심사관이 한 명을 심사하는데 걸리는 시간은 1분 이상 1,000,000,000분 이하입니다.
// 심사관은 1명 이상 100,000명 이하입니다.

class Solution {
    static long answer = Long.MAX_VALUE;
    public long solution(int n, int[] times) {
    
		Arrays.sort(times);

        long time = Long.MAX_VALUE;
        int maxTime = times[times.length - 1];
        
        bs(n,0, time, maxTime, times);
        return answer;
    }
    
    
    private void bs(int n,long fromT, long toT, int maxTime, int[] times) {        
        if (fromT > toT)
            return;
        long middleT = fromT + (toT - fromT) / 2;        
        
        long t = agg(middleT, times, n);
        //t : 현재 시간에서 처리가능한 인원
        if (t >= n) {
            if (middleT < answer)
                answer = middleT;
            bs(n, fromT, middleT -1, maxTime, times);
        } else {
            bs(n, middleT + 1, toT, maxTime, times);
        }
    }
    
    private long agg(long curTime, int[] times, int target) {
        long t = 0;
        
        for (int i = 0;  i < times.length; i++) {
            t += curTime / times[i];
            if (t > target)
                return t;
        }
        return t;
    }
}

