import java.util.*;

class Solution{
    public int solution(String name) {
        int answer = 0;
        int[] poses = new int[name.length()];
        for (int i = 0; i < name.length(); i++) {
            poses[i] = Math.min(name.charAt(i) - 'A', 26 - (name.charAt(i) - 'A'));
        }
        
        System.out.println(Arrays.toString(poses));
        
        // the first;
        int updownSum = Arrays.stream(poses).sum();
        answer = updownSum + name.length() - 1;
        
        
        // let's go greedy
        // A를 만나면 해당 A의 좌우측에 대해서
        // 현재 위치로부터 l 과 r 을 구해서
        // l * 2 + r or r * 2 + l 중 작은게 해당 A문자열에 대한 최소한의 무빙.
        
        for (int i = 0; i < name.length() ;i++) {
            if (name.charAt(i) == 'A') {
                int j = i;
                while (j < name.length() && name.charAt(j) == 'A')
                    j++;
                
                
                int l = Math.max(i - 1, 0);
                int r = name.length() - j;
                int move = Math.min(l * 2 + r, r * 2 + l);
                
                answer = Math.min(move + updownSum, answer);
            }
        }
        
        
        return answer;
    }
}
